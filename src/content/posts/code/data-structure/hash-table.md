---
title: 哈希表及其工作原理
published: 2026-01-10
description: 数据结构
tags: [数据结构]
category: 数据结构
draft: false
---

# 哈希表

## 哈希表的简介

**哈希表（Hash Table）**，又称为**散列表**，是一种基于 **键值对（Key-Value Pair）** 存储的数据结构。它通过哈希函数将键（Key）映射为数组索引，从而实现高效的插入、查找和删除操作。



## 哈希表的数学描述
数学语言上，可以将其看做一种映射，即：
$$
\begin{aligned}
f &: X \rightarrow Y \\
  &: x_i \mapsto y_i
\end{aligned}
$$
其中 **X为输入数据的集合，Y为桶下标集合，f为哈希函数。** <br>
描述的是一个key经过哈希函数f映射后，得到的一个桶下标。然后将所要的数据存到该桶中，方便后续查询。

**当然这是简化版，详细的：(看不懂没关系，不用硬看)**

设有有序键序列：
$$
\mathbf{x} = (x_1, x_2, \dots, x_n)， x \in X
$$
定义每个元素的基础哈希函数：
$$
h_i = H_i(x_i), \quad h_i \in \mathbb{N}
$$
定义状态递推的混合函数：
$$
\operatorname{mix}(S, h)
=
S
\;\oplus\;
\big(
h
+ C
+ (S \ll a)
+ (S \gg b)
\big)
$$
其中 $C$ 为常数，$a,b>0$ 为位移参数。

设初始状态：
$$
S_0 = 0
$$
则组合哈希状态按顺序递推为：

$$
S_k = \operatorname{mix}(S_{k-1}, h_k),
\quad k = 1, \dots, n
$$

最终组合哈希值为：

$$
S = S_n
$$

若哈希表具有 $m$ 个桶，则键 $\mathbf{x}$ 映射到桶索引 $t$ 的完整映射为：

$$
\boxed{
\begin{aligned}
t
&=
\operatorname{index}(\mathbf{x}) \\
&=
S \bmod m \\
&=
\Big(
\operatorname{foldl}
(
\operatorname{mix},
0,
(H_1(x_1), \dots, H_n(x_n))
\Big)
\Big)
\bmod m
\end{aligned}
}
$$




## 哈希表的性能特性

### **时间复杂度**
一般为**O(1)**,但这一般要满足**没有哈希冲突**<br>
这往往意味着桶的数量多但数据较少，且没有人为根据哈希函数去构造的冲突键值对<br>

一旦有冲突，那就需要根据哈希表解决哈希冲突时的方案具体来看了。

### **空间复杂度**
设：<br>
存储的元素个数：n<br>
桶（bucket）数量：m<br>
负载因子（load factor）：<br>
$$
    α = \frac{n}{m}
$$
理论空间复杂度
$$
Space = O(n+m)
$$
O(n)：实际存储的键值对<br>
O(m)：哈希桶数组（哪怕是空桶，也占空间）<br>

在“理想 O(1)”假设下<br>

为了保持 **期望时间复杂度 O(1)**，必须满足：
$$
α=\frac{n}{m}=O(1)   ⇒   Space = O(n)
$$

> 这里明确说明，有写教学会说哈希表在使用时，是只为出现过的键付空间，显然在底层上可以这么去实现哈希表，但效率往往会非常低，这在后期会提到哈希表的实现为了高效率，会像动态数组那样申请大空间：

## 哈希表的在哈希冲突上的解决方案

**一般有两个大类：**
1. 分离存储（Separate Chaining）
2. 开放定址（Open Addressing）

### 分离存储（拉链法 / Separate Chaining）
* 大意是对桶内多个数据串成链表，然后查找时先通过哈希函数计算得到的桶下标，查找对应桶内链表上是否存在该元素。

### 开放定址（Open Addressing）
* 大意是对一个元素，经过映射后发现桶下标对应的桶内已经有元素，那么就将该元素放到下一个桶，当下一个桶也有元素，则继续查找下一个桶，直到找到一个空桶并放入。

还有一些方法可以在这个视频查看：
<iframe width="100%" height="468" src="//player.bilibili.com/player.html?bvid=BV13NwveLE1D&p=1&autoplay=0" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" &autoplay=0> </iframe>


## 哈希表的代码实现(统一c++写)
* tip: 如果要实现一个纯正的哈希表，最好还是了解前面的数学公式哦

### 1. 先来个简单的，字母到数字的映射：<br>
* 这个很简单，因为用个数组就成功了，哈希函数就是ASCII编码转换而已
```cpp
namespace my{
int hash[26] = {0};
}
void insert(char input) {
    if(isupper(input))  ++my::hash[input - 'A'];
    if(islower(input))  ++my::hash[input - 'a'];
}
int find(char input) {
    if(isupper(input))  return my::hash[input - 'A'];
    if(islower(input))  return my::hash[input - 'a'];
}
```

### 2. 然后写一个int->int的哈希表，但是这次要求数据和桶下标是不能一样的，不然又是创建一个数组记录就解决的事了
```cpp
#include <iostream>
#include <vector>
#include <list>

class IntHashMap {
private:
    // 桶的数量
    size_t bucket_count;
    // 每个桶是一个 list<pair<key,value>>
    std::vector<std::list<std::pair<int,int>>> buckets;
    // 哈希函数：简单取模
    size_t hash(int key) const {
        return key % bucket_count;
    }

public:
    // 构造函数
    IntHashMap(size_t buckets_num = 16) : bucket_count(buckets_num), buckets(buckets_num) {}
    // 插入或更新
    void put(int key, int value) {
        size_t idx = hash(key);
        for (auto &p : buckets[idx]) {
            if (p.first == key) {
                p.second = value; // 更新
                return;
            }
        }
        buckets[idx].push_back({key, value}); // 插入
    }
    // 查询，找不到返回 false
    bool get(int key, int &value) const {
        size_t idx = hash(key);
        for (const auto &p : buckets[idx]) {
            if (p.first == key) {
                value = p.second;
                return true;
            }
        }
        return false;
    }
    // 删除
    bool remove(int key) {
        size_t idx = hash(key);
        for (auto it = buckets[idx].begin(); it != buckets[idx].end(); ++it) {
            if (it->first == key) {
                buckets[idx].erase(it);
                return true;
            }
        }
        return false;
    }
    // 打印整个表（调试用）
    void print() const {
        for (size_t i = 0; i < bucket_count; ++i) {
            std::cout << "Bucket " << i << ": ";
            for (const auto &p : buckets[i]) {
                std::cout << "(" << p.first << "->" << p.second << ") ";
            }
            std::cout << "\n";
        }
    }
};
```
测试：
```cpp
int main() {
    IntHashMap map(8);

    map.put(1, 10);
    map.put(2, 20);
    map.put(10, 100); // 冲突到 bucket 2（10 % 8 = 2）

    map.print();

    int value;
    if (map.get(2, value)) {
        std::cout << "Key 2 -> " << value << "\n";
    }

    map.remove(1);
    map.print();

    return 0;
}
```
输出：
```cpp
Bucket 0: 
Bucket 1: (1->10) 
Bucket 2: (2->20) (10->100) 
Bucket 3: 
Bucket 4: 
Bucket 5: 
Bucket 6: 
Bucket 7: 
Key 2 -> 20
Bucket 0: 
Bucket 1: 
Bucket 2: (2->20) (10->100) 
Bucket 3: 
Bucket 4: 
Bucket 5: 
Bucket 6: 
Bucket 7: 
```
可见哈希函数是给元素分配到桶的关键函数。现在这个例子将会侧重于哈希函数的编写,具体的插入等操作交给unordered_map：

### 3. tuple->int的哈希函数写法
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

这里主要讲解
```cpp
std::apply([&seed](const Ts&... args) {
            ((seed ^= std::hash<Ts>{}(args)
              + 0x9e3779b9
              + (seed << 6)
              + (seed >> 2)), ...);
        }, t);
```
显然，这里的哈希函数是先得到tuple的各个元素，在根据各个元素的哈希函数变换混合后得到的seed,也就是桶下标

根据前面讲到的数学公式，在这里有：

设 tuple 为：

$$
\mathbf{x} = (x_1, x_2, \dots, x_n)
$$

每个元素的基础哈希：

$$
h_i = H(x_i), \quad i = 1,\dots,n
$$

定义递推组合哈希函数：

$$
S_0 = 0
$$

$$
S_k = S_{k-1} \;\oplus\; \big( h_k + 0x9e3779b9 + (S_{k-1} \ll 6) + (S_{k-1} \gg 2) \big), \quad k = 1,\dots,n
$$

最终组合哈希值：

$$
S = S_n
$$

映射到桶索引：

$$
t = S \bmod m
$$

综上，便是：

$$
\boxed{
\begin{aligned}
S_0 &= 0, \\
S_k &= S_{k-1} \;\oplus\; \big(h_k + 0x9e3779b9 + (S_{k-1} \ll 6) + (S_{k-1} \gg 2)\big), \quad k = 1,\dots,n, \\
t &= S_n \bmod m
\end{aligned}
}
$$

或者

$$
\boxed{
t = \Bigg(
\bigoplus_{k=1}^{n} \big( h_k + 0x9e3779b9 + (S_{k-1} \ll 6) + (S_{k-1} \gg 2) \big)
\Bigg) \bmod m
}
$$

这里的 ⊕ 表示“按顺序的累积 XOR + 位移混合”，可以注释说明：

- ⊕：按顺序累积状态
- h_k：元素哈希
- 位移 + 常数：信息扩散

### 4. 最后，不用unordered_map实现一次哈希表
```cpp
#include <iostream>
#include <vector>
#include <list>
#include <tuple>

// -------------------- 组合哈希函数 --------------------

// 单元素哈希（使用 std::hash）
template <typename T>
size_t hash_val(const T &v) {
    return std::hash<T>{}(v);
}
// 递归折叠 tuple
template <typename Tuple, size_t Index = 0>
struct TupleHasher {
    static size_t apply(const Tuple &t) {
        size_t seed = TupleHasher<Tuple, Index + 1>::apply(t);
        size_t h = hash_val(std::get<Index>(t));
        // 对应公式 S_k = S_{k-1} ⊕ (h_k + 0x9e3779b9 + (S_{k-1} << 6) + (S_{k-1} >> 2))
        seed ^= h + 0x9e3779b9 + (seed << 6) + (seed >> 2);
        return seed;
    }
};
// 递归终止
template <typename Tuple>
struct TupleHasher<Tuple, std::tuple_size<Tuple>::value> {
    static size_t apply(const Tuple &) { return 0; }
};
// 外部接口
template <typename... Ts>
size_t hash_tuple(const std::tuple<Ts...> &t) {
    return TupleHasher<std::tuple<Ts...>>::apply(t);
}

// -------------------- 哈希表定义 --------------------

template <typename... Ts>
class TupleHashMap {
private:
    using Key = std::tuple<Ts...>;
    using Pair = std::pair<Key, int>;

    size_t bucket_count;
    std::vector<std::list<Pair>> buckets;

    size_t hash(const Key &key) const {
        return hash_tuple(key) % bucket_count;
    }

public:
    TupleHashMap(size_t buckets_num = 16) : bucket_count(buckets_num), buckets(buckets_num) {}
    // 插入或更新
    void put(const Key &key, int value) {
        size_t idx = hash(key);
        for (auto &p : buckets[idx]) {
            if (p.first == key) {
                p.second = value; // 更新
                return;
            }
        }
        buckets[idx].push_back({key, value}); // 插入
    }
    // 查询
    bool get(const Key &key, int &value) const {
        size_t idx = hash(key);
        for (const auto &p : buckets[idx]) {
            if (p.first == key) {
                value = p.second;
                return true;
            }
        }
        return false;
    }
    // 删除
    bool remove(const Key &key) {
        size_t idx = hash(key);
        for (auto it = buckets[idx].begin(); it != buckets[idx].end(); ++it) {
            if (it->first == key) {
                buckets[idx].erase(it);
                return true;
            }
        }
        return false;
    }
    // 打印所有桶
    void print() const {
        for (size_t i = 0; i < bucket_count; ++i) {
            std::cout << "Bucket " << i << ": ";
            for (const auto &p : buckets[i]) {
                std::cout << "(";
                std::apply([](auto&&... args){ ((std::cout << args << ","), ...); }, p.first);
                std::cout << "->" << p.second << ") ";
            }
            std::cout << "\n";
        }
    }
};

// -------------------- 测试 --------------------

int main() {
    TupleHashMap<int, int, int> map;

    map.put(std::make_tuple(1, 2, 3), 100);
    map.put(std::make_tuple(4, 5, 6), 200);
    map.put(std::make_tuple(1, 2, 3), 150); // 更新

    map.print();

    int value;
    if (map.get(std::make_tuple(1, 2, 3), value)) {
        std::cout << "Value for (1,2,3) = " << value << "\n";
    }

    map.remove(std::make_tuple(4, 5, 6));
    map.print();

    return 0;
}

```
