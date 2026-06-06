---
title: c++ unordered_map中对tuple，pair哈希类型的拓展写法[写完待查错优化]
published: 2026-01-07
description: 拓展
tags: [拓展]
category: 拓展
draft: false
---

## 前言
> 不知道你是否有过和我一样的经历：当尝试使用unordered_map建立起pair<int, int>或者tuple<...> 到int类型的映射时：
```c
int main() {
    std::unordered_map<std::tuple<int,int>, int> mp;
    ++mp[{3,5}];
    std::cout << mp[{3,5}];
}
```
> 然后发现编译器给你当头一棒
```
无法引用 "std::unordered_map<std::tuple<int, int>, int, std::hash<std::tuple<int, int>>, std::equal_to<std::tuple<int, int>>, std::allocator<std::pair<const std::tuple<int, int>, int>>>" 的默认构造函数 -- 它是已删除的函数
```
> 为什么会这样呢？<br>
> 起始归根结底，pair有两个参数，tuple可以有两个或多个参数，也就是说hash的方式有很多种，c++设计者想把怎样hash的选择权交给你。所以你需要自己实现。

## 实现思路

要解决这个问题，我们需要从 `unordered_map` 的类定义入手。

```cpp
template<
    class Key,
    class T,
    class Hash = std::hash<Key>,
    class KeyEqual = std::equal_to<Key>,
    class Allocator = std::allocator<std::pair<const Key, T>>
> class unordered_map;
```

| 参数名称 | 描述 | 默认值 |
| :--- | :--- | :--- |
| **_Key** | 容器中 key 的类型。 | (必填) |
| **_Tp** | 容器中 value 的类型。 | (必填) |
| **_Hash** | **[关键点]** 用于计算 Key 的哈希值的函数对象。 | `std::hash<_Key>` |
| **_Pred** | 用于判断两个 Key 是否相等的函数对象。 | `std::equal_to<_Key>` |
| **_Alloc** | 用于管理容器内存的分配器。 | `std::allocator<...>` |

通过查看unordered_map需要的参数，我们可以看到 `unordered_map` 共有五个模板参数。编译器之所以报错，是因为第三个参数（哈希函数）在面对 `tuple` 或 `pair` 时失效了，因为c++没有内置默认的hash方案。想要解决这个问题，我们要手动传入一个 `std::hash<Key>`。

> 这里顺便提一嘴，**你是否想过为什么不是传入一个函数(例如lambda表达式)呢？**<br>
> **这里涉及到几个问题：**<br>

> 1️⃣ 显然，按照**官方要求**，unordered_map 的定义要求第三个模板参数是一个**类型（Type）**，而不是一个具体的函数名或变量。
> * 如果你给**函数**：函数本身不是一个类型。虽然你可以用 decltype 强行提取函数指针类型，但写起来非常啰嗦。
> * 如果你给**struct**：struct 就是一个标准的类型。你直接把 MyHashStruct 填进去，编译器就能在编译阶段知道“这就是我们要找的哈希策略”。

> 2️⃣ **极致的性能**：内联优化（Inlining）->这是 C++ 程序员最看重的一点。
> * 使用**struct（重载 operator()）**： 编译器在编译 unordered_map 的代码时，知道 Hash 参数的具体类型。因为哈希逻辑就在这个类型的 operator() 里，编译器可以非常容易地进行内联（Inline）。也就是说，它会把哈希逻辑直接“打碎”并嵌入到容器的调用处，省去了函数调用的开销（压栈、跳转、返回）。
> * 使用**普通函数指针**： 函数指针是在运行时指向某个地址。编译器很难在编译阶段断定这个指针到底指向谁，因此很难进行内联。在哈希表这种需要频繁计算（成千上万次）的场景下，函数调用的开销积累起来会非常明显。

> 3️⃣ **符合“函数对象”的规范**：C++ STL 的设计遵循 “策略与对象分离” 的原则，这也属于是c++的内核思想：面相对象编程。<br> 不懂的话，你就理解为这是一个你自己写的 **模块** ,为了拼接到unordered_map上，你要自己弄一个模块换上去！！！<br>


**因此，我们需要写一个struct,里面包含一个函数（应当叫`函数对象`或者`仿函数`，因为要用operator()，不懂得话就看下面的Q4就行）用于处理hash的实现**

**好了，不废话了，再说你估计也看不下去了😴** <br>
不妨先看一个完整代码示例吧:

## 具体实现(针对上面例子)

```cpp
#include <bits/stdc++.h>

struct TupleHash {
    template <typename... Ts>
    size_t operator()(const std::tuple<Ts...>& t) const noexcept {
        size_t seed = 0;
        std::apply([&seed](const Ts&... args) {
            ((seed ^= std::hash<Ts>{}(args)
              + 0x9e3779b9
              + (seed << 6)
              + (seed >> 2)), ...);
        }, t);
        return seed;
    }
};

int main() {
    std::unordered_map<std::tuple<int,int>, int, TupleHash> mp;

    ++mp[{3,5}];
    std::cout << mp[{3,5}];
}
```
- 在这个代码中，我们已经自己写了一个struct TupleHash，并且将其传入了unordered_map的第三个参数中。这样子unordered_map就可以使用你自己的hash方案了。

**现在，我来讲解一下这个struct TupleHash在干嘛：(超详细讲解哦)**

### Q1: 为什么必须写成struct？
>   罚你去看前面的内容🤗<br>
>   你不看的话也没问题，简单来说，你要按unordered_map的规则，在第三个参数那里传入一个struct/class(一般写struct,class也没问题)，而且这样有利于程序性能提高。
>   还有就是，想让unordered_map识别_Hash,你就需要按这个规则写代码
>   ```cpp
>   struct TupleHash {
>       size_t operator()(Key) const;
>   };
>   ```


### Q2: 里面那一坨是什么？
>   别急，别被吓着了，且听我慢慢道来, 我会逐行讲解意思。

### Q3: template <typename... Ts>是干什么的？
>   template是c++的关键字之一，用到了这个就是告诉编译器你要写一个模版<br>
>   对于模版你可能不认识？我就举个例子你就懂了<br>
>   假设你要写一个函数，用于打印输出**各种数据**，在c++里面，你可以这么写：  
>   ```cpp
>   void printData(int data) {std::cout << "Data: " << data << std::endl;}
>   void printData(float data) {std::cout << "Data: " << data << std::endl;}
>   void printData(std::string data) {std::cout << "Data: " << data << std::endl;}
>   ......
>   ```
>   看起来有点麻烦，因为显然语法上他们太重复了对吧。这还是**好看的**。之说以这样说，是因为c++还是支持函数重载的（也就是以上例子的函数都可以被命名为`printData`，运行时编译器会根据传入类型选择对应的实现方式）。但是对于c用户，没有函数重载这种语法，于是就可能要这么写:
>   ```c
>   void printData_int(int data) {printf("%d", data);}
>   void printData_float(float data) {printf("%f", data);}
>   void printData_string(char* data) {printf("%s", data);}
>   ......
>   ```
>   显然，你还需要改函数名字，不能让函数名字重复，这更麻烦了。
>   假设你是c++的开发者，自然也会想到怎么让语法更为简洁，于是template就孕育而生了
>   用了template,我们就可以这么写上面的代码
>   ```cpp
>   template <typename T>
>   void printData(T data) {std::cout << data << endl;}
>   ```
>   此时T就是会根据传入内容的类型而变化的变量类型名。
>   是不是瞬间清爽多了！！！

>   然后接着讲 **<typename... T>** 又是什么意思 <br>
>   我们可以写<typename T,typename U...>来实现更多变量类型的适配，对于不确定有多少个参数的，就可以使用 **<typename... T>** <br>
>   也正是依靠他，我们才能适配不同元素个数的tuple<...>,实现万能的hash->tuple模版。

### Q4: size_t operator()(const std::tuple<Ts...>& t) const noexcept {}是干什么的？
>   **注，这里笔者也查了大量资料的，一是本人也算是个萌新，二是因为设计内容太多了** <br>
>   为了讲清楚这个，我们带入 c++设计者 的角色看待这个问题 <br>
>   然后就是，如果你还不理解 **运算符重载** 请先去看看这个文章，这是为了后面做铺垫的。

>   **你可能的第一个想法**：“我在 struct 里写个 size_t hashFunc() 不行吗？为什么非要用 operator() 这个看起来像‘黑话’一样的写法（为什么扯到operator上去了）？”<br> 
>   其实原因非常简单：**为了实现“调用接口”的完全统一。**
>
>   假设 C++ 标准库规定：如果你要自定义哈希，你必须在 struct 里写一个函数。
>   那么问题来了：这个函数该叫什么名字？
>   - 程序员 A 喜欢叫 compute()
>   - 程序员 B 喜欢叫 get_hash_value()
>   - 程序员 C 喜欢叫 do_it()<br>
>
>   显然，如果大家起的名字都不一样，unordered_map 的开发者就疯了，因为他不知道在代码里该调用哪一个。
>   但是，operator() 是唯一的。 在 C++ 中，operator() 是语法级别的约定。只要你重载了它，你的对象 h 就可以直接通过 h() 来调用。编译器不需要知道你给函数起了什么名，它只认那个括号。
>
>   于是在unordered_map的内部（你不许要完全知到unordered_map是如何实现的），就会这样子：<br>
> 1.你传入了定义的 struct MyHash。<br>
> 2.unordered_map 在内部会实例化这个 struct：MyHash h;<br>
> 3.当需要哈希时，它直接像函数一样调用这个实例：size_t val = h(key);。<br>

>   **然后你可能又会有的疑惑**<br>
>   **为什么这个函数会被标记`const`和`noexcept`?**<br>
>   **第一个**，const, 相当于你告诉编译器：“我发誓我只读不写，我不会搞坏哈希策略本身。”<br>
>   **第二个**，noexcept： “我发誓我绝对稳定，计算过程中不会突然‘罢工’抛异常。”<br>
>   **最重要的**，告诉编译器noexcept,实质上是告诉编译器你可以**更激进的使用某些策略优化性能**，例如**移动语义(move)**<br>
>   对于移动语义：很多 STL 容器（比如 vector 扩容或 unordered_map 重哈希）在移动元素时，会检查相关函数是否标记了 noexcept。<br>
>如果你标记了：容器会放心地使用高性能的“移动”操作。<br>
>如果你没标记：为了防止移动中途出错导致数据丢失，容器可能会退而求其次，选择低效的“拷贝”操作，这会导致性能大幅下降。<br>

>   最后就是**const std::tuple<Ts...>& t**了,显然,只是让你向struct里的匿名函数里面传入参数而已<br>
>   然后对于返回值，size_t是指定的哈希值标准类型

### Q5:（哈希核心） std::apply([&seed](const Ts&... args) {((seed ^= std::hash<Ts>{}(args)+ 0x9e3779b9+ (seed << 6)+ (seed >> 2)), ...);}, t);是什么意思？

>   为了搞明白这段代码到底在干什么，先不妨看这篇文章：
[哈希表及其工作原理](/posts/code/data-structure/hash-table/)<br>
我已经将该例子的哈希函数嵌入到这篇文章的哈希函数实现的第三个例子，这里主要讲一些语法问题

> std::apply() 其意义是将元组展开为参数包:<br>
> 如std::apply([&seed](const Ts&... args) {
    ...
}, t);<br>
> 等价<br>
> // 假设 t = tuple{a, b, c}<br>
> lambda(a, b, c);<br>
> 注:lambda意思是匿名函数
