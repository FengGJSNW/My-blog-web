---
title: 广东工业大学 ACM-ICPC 第一次比赛(2025/10/19月月赛)[已更新部分讲解]
published: 2026-01-12
description: 讲解与解题的思考历程
tags: [比赛, 讲解]
category: 比赛
draft: false
---

## 📜 **试题查看与下载**
<a href="/assets/blog_article/material/2025-10-19-oct-contest.pdf" target="_blank">📥 点击下载/在线查看：2025/10/19年月赛题面</a>  
<br>
<a href="/assets/blog_article/material/2025-10-19-oct-contest-answer.pdf" target="_blank">📥 点击下载/在线查看：2025/10/19年月赛题解</a>

<!-- <br>
<a href="/assets/blog_article/material/2025-10-19-oct-contest-answer.pdf" target="_blank">📥 文章内的程序下载[还没整理完] </a> -->


---

## 🖥️ **测试/补题链接**
<a href="https://codeforces.com/gym/106130" target="_blank">GDUT 2025 Monthly competition</a>  

---
## 🔖 **题目跳转**

| 编号 | 题目名 | 难度 | 编号 | 题目名 | 难度 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A | [%%%自动机](#自动机) | 签到 | H | [我不吃水果](#我不吃水果) | Easy |
| B | [k-冲突数对](#k-冲突数对) | M-Hard | I | [运动世界校园](#运动世界校园) | 签到 |
| C | [序列重构（简单版）](#序列重构简单版) | E-Med | J | [逃出生天](#逃出生天) | Easy |
| D | [序列重构（困难版）](#序列重构困难版) | Medium | K | [最不上升也不下降序列](#最不上升也不下降序列) | E-Med |
| E | [新田忌赛马](#新田忌赛马) | Easy | L | [翻转硬币](#翻转硬币) | 签到 |
| F | [雪莉的预言](#雪莉的预言) | Medium | M | [字符消消乐](#字符消消乐) | Easy |
| G | [俄罗斯方块的博弈](#俄罗斯方块的博弈) | E-Med | N | [缩花](#缩花) | Medium |

---

## 📈 **官方参考难度与通过率**
> 本比赛大多数人都为新手，就大概10人为0基础，然后有很多人是报名后水学分的，没有答题，所以最好根据AC率之比来评判题目之间的难度差。

> 非零基础标准：至少1年编程经验（不是Scratch那种），或者曾经有过参赛经验的人

| 题目 | 官方难度 | 通过人数 (封榜前) | 通过率 (AC/Total) |
| :--- | :--- | :--- | :--- |
| **A** | 签到 | **153** | 58.1% |
| **I** | 签到 | **122** | 41.8% |
| **L** | 签到 | **60** | 50.4% |
| **M** | Easy | 39 | 31.7% |
| **J** | Easy | 32 | 35.9% |
| **H** | Easy | 28 | 18.4% |
| **E** | Easy | 24 | 9.6% |
| **C** | Easy-Medium | 11 | 22.0% |
| **K** | Easy-Medium | 8 | 11.2% |
| **G** | Easy-Medium | 7 | 4.0% |
| **F** | Medium | 1 | 20.0% |
| **D** | Medium | 1 | 10.0% |
| **B** | Medium-Hard | 1 | 4.3% |
| **N** | Medium | 0 | 0.0% |

---

## 🔑 **开始解题🥰**
> **温馨提示：**解题时主要使用的是**c++(c20/c23/c26标准)**，对于c(c99)和c++(c17及以下版本)看情况给出模版。

### %%%自动机
[⬅️ 返回目录](#-题目跳转)

这里没什么好讲的，直接粘代码就好了:
```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;  cin >> n;
    while(n--) cout << "%";
}
```
考虑到有人用c(c99标准)，再粘贴一个c版本的。(这里主要针对初学者)
```c
#include <stdio.h>

int main() {
    int n;
    scanf("%d", &n);
    while(n--) printf("%%");    //两个%%打印一个%
}
```

---

### k-冲突数对
[⬅️ 返回目录](#-题目跳转)

不妨先尝试一个较为朴素的解法：

这里使用了gcd辗转相除法+滑动窗口的解法：
#### 第一次尝试
```cpp
#include <bits/stdc++.h>
using namespace std;

int gcd(int a,int b)
{
	if(b==0) return a;
	return gcd(b,a%b);
}

inline bool impact(int x, int y, int k) {
    return x + y - gcd(x, y) == k;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    int n, k;
    cin >> n >> k;

    vector<long long> data(n);
    for(int i = 0;i < n;++i)
        cin >> data[i];

    int l = 0, r = 0, len = 0;
    while (r < n) {
        bool bad = impact(data[r], data[r], k) ? true : false;

        for (int cur = l; !bad && cur < r; ++cur) {
            if (impact(data[cur], data[r], k)) {
                bad = true;
            }
        }

        if (!bad) {
            len = max(len, r - l + 1);
            ++r;
        } else {
            ++l;
            if (l > r) {
                r = l;
            }
        }
    }

    cout << len;
}
```
该解法时间复杂度在$$\mathbf{O(n^2 \log n)}$$，大概能解决长度1e4-1e5级别的数组（1s内），但是目标是要解决1e6级别的，显然，差了两个数量级，我们要继续优化

对于gcd的部分，已经是竞赛的常用最优解了，不需要再优化，那么我们要从滑动窗口这边继续优化，将$$\mathbf{O(n^2)}$$的时间复杂度降下去。

我们能考虑的思路有：剪枝，哈希表，还有k-冲突数对内在的数学性质等等一系列解决方案。

不妨先从数学性质入手，看看它暗含什么信息：

我们先这样假设:
$$
x = at, y = bt, t = gcd(x, y) (a,b ∈ Z,gcd(a, b) = 1)
$$
然后得到:
$$
at + bt - t = k \\
t(a + b - 1) = k \\
t(b - 1) = k - x \\
$$
于是推出两个必要条件:
$$
t \mid (k - x) \\
$$
由于x = at,显然
$$
t \mid x
$$
那么也能得到
$$
t \mid k\\
$$
于是立刻得到：
$$
t \mid gcd(x, k)
$$
即：
$$
\boxed{
    t = gcd(x,y) \mid gcd(x,k)
}
$$

然后就是提一下，当我们可以忽略x>k的情况，因为这时不存在冲突数对，证明如下：

由原式
$$
x + y − gcd(x, y) = k
$$
且
$$
gcd(x, y) \le y
$$
于是$$x \le y$$才能存在冲突数对，因此我们只需注意$$x \le y$$的情况。

于是，从“原始判定”到“枚举 t 的等价形式”，有：
> x + y − gcd(x,y) = k<br>
> ⟹<br>
> 对于某个$$t \mid gcd(x, k)$$
> 令<br>
> y = k - x + t<br>
> 再检查是否满足<br>
> gcd(x, y) = t<br>

这是因为k是常量，而𝑥是枚举过程中唯一变化的变量，并且由前面的推导可知，只需考虑$$x \le k$$的情形。
于是我们不妨这样做：

开一个一维数组：factor_k,求出k的所有因子。

开一个二维数组: factor_table，在factor_table[d]存储d的所有因子，其中对于d,其必然是k的因子。

这样，在枚举过程中，我们就可以通过
```cpp
for (auto t : factor_table[gcd(x, k)]) {}
```
来遍历所有满足$$t = gcd(x,y) \mid gcd(x,k)$$的可能取值

再保留滑动窗口的思路，就有了以下代码：
#### 第二次尝试
```cpp
#include <bits/stdc++.h>
using namespace std;

long long gcd(long long a,long long b)
{
	if(b==0) return a;
	return gcd(b,a%b);
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    int n, k;
    cin >> n >> k;

    vector<long long> data(n);
    for(long long i = 0;i < n;++i)
        cin >> data[i];

    vector<long long> factor;
    for(long long i = 1;i * i <= k;++i) {
        if (k % i != 0) continue;
        factor.push_back(i);
        if (i * i != k) factor.push_back(k / i);
    }
    vector<vector<long long>> factor_table(k+1);
    for(long long x : factor) {
        for(long long y : factor) {
            if(y % x != 0)  continue;
            factor_table[y].push_back(x);
        }
    }

    int ans = 0;
    vector<int> mark(k+1);
    for(int l = 0, r = 0; r < n; ++r) {
        long long x = data[r];

        if(x <= k) mark[x]++;

        long long g = gcd(x, k);
        for(auto d : factor_table[g]) {
            long long y = k - x + d;
            if(y <= 0 || y > k) continue;
            if(gcd(x, y) != d) continue;

            while(y <= k && mark[y] && l <= r) {
                if(data[l] <= k) mark[data[l]]--;
                l++;
            }
        }

        ans = max(ans, r - l + 1);
    }
    cout << ans;
}
```
这时，代码已经成功AC。

该代码的性能：<br>
Time：968ms <br>
Memory：34600KB

时间复杂度分析：
1. 因数预处理,复杂度：O(√n)
2. 滑动窗口部分:外层循环 r → O(n);内层循环 d ∈ factor_table[g] → O(√n)
3. gcd(x,y) → O(log k)

共计 $$\mathbf{O(n \sqrt{n} \log n)}$$

此时程序能解决的数组大小在40000左右，还是有一定风险不通过，毕竟$$1 \le a_i \le 1081080$$,考虑这是讲解...

于是，**继续优化！！！：**

不难发现，结合前面的例子，**反复求解gcd()是一个极大的性能瓶颈**，而我们还有一个gcd(x, y)仍旧需要反复求解。于是我们的第一个想的目标就是**消灭所有滑动窗口阶段运行的gcd()，将他们全部预处理化。**

核心观察上：<br>
还是令
$$
x = at, y = bt, t = gcd(x, y) (a,b ∈ Z,gcd(a, b) = 1)
$$
那么
$$
gcd(x, y) = t ⟺ gcd(a, b) = 1
$$
带入
$$
y = k − x + t ⇒ b = \frac{k}{t}​− a + 1
$$
于是我们的等价判断条件呼之欲出！！！
$$
\boxed{
gcd(\frac{x}{t}, \frac{k}{t} - \frac{x}{t} + 1) = 1
}
$$
此时我们只需要把原来的等式判定转化为两个数互质的判定即可。
1. 预处理最小因子
$$
f[i] = i的最小因子
$$
作用:
* O(log n) 分解任意整数

* 为后续“是否含有非法质因子”服务
2. 对每个 t，预处理合法性表 h[t]
目标是回答这个问题：
对于固定的t,给定$$u = \frac{x}{t}$$是否有
$$
gcd(u, \frac{k}{t} - u + 1) = 1
$$

思路：
* 设$$K = \frac{k}{t} + 1$$
* 若$$ p \mid K$$，且$$p \mid u$$,则不互质
* 所以只需判断：u是否包含K的质因子

预处理方式：
h[t][u] = 是否非法

3. 枚举顺序的优化+剪枝
* 枚举t时注意从小到大
这是因为t = k - x + t<br>
t越小，y越靠左，更早出发窗口收缩，减少后续冲突
* 然后注意，直接逃过非法y

#### 第三次尝试
```cpp
#include <bits/stdc++.h>
using namespace std;

constexpr int INF = 1e9;


int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, k;
    cin >> n >> k;

    vector<int> data(n + 1);
    for (int i = 1; i <= n; i++) cin >> data[i];

    /* ---------- 1. k 的所有因子 ---------- */
    vector<int> factor;
    for (int i = 1; i * i <= k; i++) {
        if (k % i) continue;
        factor.push_back(i);
        if (i * i != k) factor.push_back(k / i);
    }
    sort(factor.begin(), factor.end());

    int m = factor.size();
    unordered_map<int,int> id;
    for (int i = 0; i < m; i++) id[factor[i]] = i;

    /* ---------- 2. factor[d] = d 的所有因子（d | k） ---------- */
    vector<vector<int>> fac(m);
    for (int i = 0; i < m; i++) {
        for (int j = i; j < m; j++) {
            if (factor[j] % factor[i] == 0)
                fac[j].push_back(i);
        }
    }

    /* ---------- 3. 最小质因子预处理 ---------- */
    int min_prime = k + 1;
    vector<int> spf(min_prime + 1);
    for (int i = 2; i <= min_prime; i++) {
        if (!spf[i]) {
            spf[i] = i;
            if ((long long)i * i <= min_prime)
                for (long long j = 1LL * i * i; j <= min_prime; j += i)
                    if (!spf[j]) spf[j] = i;
        }
    }

    /* ---------- 4. h[id][u]：是否合法 ---------- */
    vector<vector<char>> h(m);
    for (int i = 0; i < m; i++) {
        int t = factor[i];
        int K = k / t + 1;

        vector<char> bad(K + 1, 0);

        int tmp = K;
        vector<int> primes;
        for (int x = tmp; x > 1; ) {
            int p = spf[x];
            primes.push_back(p);
            while (x % p == 0) x /= p;
        }

        for (int p : primes) {
            for (int j = p; j <= K; j += p)
                bad[j] = 1;
        }

        h[i].resize(K + 1);
        for (int u = 1; u <= K; u++)
            h[i][u] = bad[u];
    }

    /* ---------- 5. 滑动窗口 ---------- */ 
    vector<int> cnt(k + 1);
    int ans = 0;
    for (int l = 0, r = 1; r <= n; r++) {
        int x = data[r];
        if (x <= k) cnt[x]++;

        if (x <= k) {
            int gx = gcd(x, k);
            int gid = id[gx];

            for (int tid : fac[gid]) {
                int t = factor[tid];
                int y = k - x + t;
                if (y <= 0 || y > k) continue;

                int u = x / t;
                if (u < (int)h[tid].size() && h[tid][u]) continue;

                while (cnt[y]) {
                    if (data[++l] <= k) cnt[data[l]]--;
                }
            }
        }
        ans = max(ans, r - l);
    }

    cout << ans << '\n';
    return 0;
}

```

此时，程序的性能达到了前所未有的提升：<br>
Time:406ms<br>
Memory:13900KB

你可能觉得时间变化不大，这是因为评测机和多组测试数据的缘故。<br>
但衡量一个程序性能的显然不能只靠这个，要靠时间复杂度判断

本程序时间复杂度为：$$\mathbf{O(k \log \log k + n \cdot d(k))}$$

此时可以处理至**1e7级别**的数据，甚至超过了题目要求！！！




---

### 序列重构（简单版）
[⬅️ 返回目录](#-题目跳转)

简单版的简单之处在于你可以输出询问一个可重复序列，困难版本中这是不被允许的：

考虑到查询次数为n^2,那么，显然在这个版本中可以对每个位置进行枚举查询即可。然后监控返回值变化即可。然后中途最好开一个数组vis用于记录已经得到答案的位置。注意输出序列后进行 **cout << flush;** 即可。

这里展示一个参考代码，感觉我自己写的有点一坨...
```cpp
#include <bits/stdc++.h>
using namespace std;
 
vector<int> ans, vis;
 
void printfa(int a,int b,int len,int mode) {
    switch(mode) {  //根据mode进行输出查询或者答案
        case 0:
            cout << '?';
            for(int i = 1;i <= len;++i) {
                if(i != a) cout << ' ' << ans[i];
                else cout << ' ' << b;
            }
            cout << endl << flush;
            break;
        case 1:
            cout << '!';
            for(int i = 1;i <= len;++i) cout << ' ' << ans[i];
            cout << endl << flush;
            break;
    }
}
 
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
 
    int t;
    cin >> t;
 
    while (t--) {
        int len;
        cin >> len;
 
        ans.assign(len + 1,0);
        vis.assign(len + 1,0);
 
        int r = 0;
        for(int i = 1;i <= len;++i) {
            for(int j = 1;j <= len; ++j) {
                if(vis[j] == 0) {
                    printfa(j,i,len,0);
                    int temp;   cin >> temp;
                    if(temp != r) {
                        ans[j] = i;
                        vis[j] = 1;
                        ++r;
                        break;
                    }
                }
            }
        }
        printfa(0,0,len,1);
    }
}
```

---

### 序列重构（困难版）
[⬅️ 返回目录](#-题目跳转)

我们需要分类讨论：


---

### 新田忌赛马
[⬅️ 返回目录](#-题目跳转)

> &emsp;**💡 解题思路**
> &emsp;...

---

### 雪莉的预言
[⬅️ 返回目录](#-题目跳转)

> &emsp;**💡 解题思路**
> &emsp;...

---

### 俄罗斯方块的博弈
[⬅️ 返回目录](#-题目跳转)

> &emsp;**💡 解题思路**
> &emsp;...

---

### 我不吃水果
[⬅️ 返回目录](#-题目跳转)

* 讲解思路
显然这是一个动态规划可以解决的问题，不懂得话就理解为按照一个规则填表即可。

填表思路：

网格为 **N*N** 的大小，考虑dp常常遇到边界问题，创建dp表格时应当考虑 **(N+1)*(N+1)** 的网格。
然后根据处理网格的方式，大概归为两种，下面画图展示：

#### 图一

#### 图二

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<vector<int>> mp(n + 1,vector<int>(n + 1,0));
    vector<vector<int>> dp(n + 1,vector<int>(n + 1,0));
    for(int i = 0;i < n;++i)
        for(int j = 0;j < n;++j)
            cin >> mp[i][j];
    
    int maxn = 0;
    for(int i = 0;i < n;++i) {
        for(int j = 0;j < n;++j) {
            if(!mp[i][j] && !dp[i][j]) {
                dp[i][j] = (i+1) * (j+1);
                maxn = max(maxn, dp[i][j]);
            } else {
                dp[i+1][j] = dp[i][j+1] = -1;
            }
        }
    }
    cout << maxn;
}
```


---

### 运动世界校园
[⬅️ 返回目录](#-题目跳转)

简单的概率问题，初中甚至小学水平，直接粘代码：
```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    double p;
    cin >> p;
    cout << fixed << setprecision(6) << p + (1-p)*p + (1-p)*(1-p)*p << endl;
}
```
---

### 逃出生天
[⬅️ 返回目录](#-题目跳转)

这题看完以后，不难发现地图是静态的，只需把石像和激光当成墙即可。那么这个题就是走迷宫的经典题型。
因此第一个思路不难想到使用DFS或BFS总能解决。

#### 这里是BFS的思路
```cpp
#include <bits/stdc++.h>
using namespace std;

struct Point {
    int x, y;
    Point(int x, int y) : x(x), y(y) {}
};

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int rows, cols;
    cin >> rows >> cols;
    vector<vector<int>> vis(rows + 2, vector<int>(cols, 0));

    for (int i = 1; i <= rows; ++i) {
        int n; char m;
        cin >> n >> m;
        if (m == 'R') {
            for (int j = n - 1; j < cols; ++j) vis[i][j] = 1;
        } else {
            for (int j = n - 1; j >= 0; --j) vis[i][j] = 1;
        }
    }

    queue<Point> qu;
    qu.emplace(0, 0); 
    vis[0][0] = 1;

    int dx[4] = {0, 0, -1, 1};
    int dy[4] = {1, -1, 0, 0};

    while (!qu.empty()) {
        Point tmp = qu.front();
        qu.pop();

        if (tmp.y == rows + 1) {
            cout << "YES" << endl;
            return 0;
        }

        for (int i = 0; i < 4; ++i) {
            int nx = tmp.x + dx[i];
            int ny = tmp.y + dy[i];

            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows + 2) {
                if (!vis[ny][nx]) {
                    vis[ny][nx] = 1;
                    qu.emplace(nx, ny);
                }
            }
        }
    }

    cout << "NO" << endl;
    return 0;
}
```

#### 这里是DFS的思路
```cpp
#include <iostream>
#include <vector>

using namespace std;

int rows, cols;
vector<vector<int>> vis;

const int dx[4] = {0, 0, -1, 1};
const int dy[4] = {1, -1, 0, 0};

bool dfs(int x, int y) {
    if (y == rows + 1) return true;

    vis[y][x] = 1;

    for (int i = 0; i < 4; ++i) {
        int nx = x + dx[i];
        int ny = y + dy[i];

        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows + 2) {
            if (!vis[ny][nx]) {
                if (dfs(nx, ny)) return true;
            }
        }
    }
    
    return false;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    cin >> rows >> cols;
    vis.assign(rows + 2, vector<int>(cols, 0));

    for (int i = 1; i <= rows; ++i) {
        int n; char m;
        cin >> n >> m;
        if (m == 'R') {
            for (int j = n - 1; j < cols; ++j) vis[i][j] = 1;
        } else {
            for (int j = n - 1; j >= 0; --j) vis[i][j] = 1;
        }
    }

    if (dfs(0, 0)) cout << "YES" << endl;
    else cout << "NO" << endl;

    return 0;
}
```
在看这个迷宫具有某些性质：
对于地图有n列n+2行;当任意行属于1,n+1时，都能走到下一行,那么整个地图必然连通到终点
于是只需两行两行的扫描判定即可。

#### 这里是根据题目特殊性质的思路
```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int y, x;
    cin >> y >> x;
    vector<vector<int>> mp(y+2,vector<int>(x));
    for(int i = 1;i <= y;++i) {
        int n;  char m;
        cin >> n >> m;
        if(m == 'R') {
            for(int j = n-1;j < x;++j)  mp[i][j] = 1;
        } else {
            for(int j = n-1;j >= 0;--j)  mp[i][j] = 1;
        }
    }

    for(int i = 0;i <= y;++i) {
        bool ok = 0;
        for(int j = 0;j < x;++j) {
            if(!mp[i][j] && !mp[i+1][j]) {
                ok = 1;
                break;
            }
        }
        if(ok == 0) {
            cout << "NO";
            return 0;
        }
    }
    cout << "YES";
}
```
最后，展示一下性能区别：（评测机给出）
| 解决方式| Time | Memory |
| :--- | :--- | :--- |
| DFS | 46ms | 19700 KB |
| BFS | 46ms | 600KB |
| 特殊做法 | 31ms | 600KB |

---

### 最不上升也不下降序列
[⬅️ 返回目录](#-题目跳转)

不妨先研究下数学性质：

根据基本不等式，显然有
$$
LIS + LDS \ge 2\sqrt{LIS*LDS}
$$
然后又有：
$$
LIS*LDS \ge n
$$
于是:
$$
LIS + LDS \ge 2\sqrt{n}
$$
因此，当 LIS ≈ LDS ≈ sqrt{n} 时，能找到最优解

然后，观察题目给出的参考数据，不难看到有**分组**和**倒序**的规律。结合上面的数学结论，尝试这样构造数列：


```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    cout.tie(nullptr);

    int n;
    cin >> n;

    // 找到使 a + ceil(n / a) 最小的 a
    int bestA = 1;
    int bestSum = n + 1;

    for (int a = 1; a * a <= n; ++a) {
        int b = (n + a - 1) / a;
        if (a + b < bestSum) {
            bestSum = a + b;
            bestA = a;
        }
    }

    int a = bestA;
    vector<int> ans;
    ans.reserve(n);

    // 分块构造：每块倒序
    for (int i = 1; i <= n; i += a) {
        int r = min(i + a - 1, n);
        for (int j = r; j >= i; --j) {
            ans.push_back(j);
        }
    }

    // 输出结果
    for (int x : ans) {
        cout << x << " ";
    }
    cout << "\n";

    return 0;
}
```
---

### 翻转硬币
[⬅️ 返回目录](#-题目跳转)

这题说是不难，但需要你能注意到其中的某些性质，否则较难通过模拟解决。
* 思考历程

打比赛时，我刚开始想不出来吧，想着可能是一种贪心题，但那时我贼菜，显然不知到怎么处理。
但是看到比赛时这题的解决率很高，搞得我又不得不思考这题。

* **第一次**，我尝试猜测可能在二进制转码到十进制可能有的规律<br>
0 -> 0<br>
1 -> 1<br>
10 -> 2<br>
...
我大概列举到了20多，没看出什么规律。然后我突然想起，这个前面能有前导0，那么显然这个思路错误了

* **第二次**，我尝试数1和0，以及他们共有的个数。
经过例举，不难发现当1为偶数，所有数字个数为偶数时，能全部翻到正面；当1为奇数，所有数字个数为奇数时，能全部翻到正面。

于是，有了以下代码并提交测试：
```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    char ch;
    int a = 0;
    while(1) {
        char ch = getchar();
        if(ch == '0')   {++a;   continue;}
        if(ch == '1')   {continue;}
        break;
    }
    if(a & 1) cout << "No"; //等价写法(a % 2 == 1)，读者自证不难(位运算)
    else cout << "Yes";
}
```
然后通过测试。<br>
总结时，我想了想，发现无论怎么翻转，1的个数是不变的，也就是奇偶性不变。<br>
然后使用贪心的思路就总能解决该问题。

---

### 字符消消乐
[⬅️ 返回目录](#-题目跳转)

有了雪碧给的魔法后，这题一下子就简单明了了：
记录字符个数，按照从大到小的顺序排序，然后每次去除最大者即可。
最后，注意到k允许大于26，注意数组边界。
```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    vector<int> hash(26,0);

    int t = a;
    while(t--) {
        char ch;
        cin >> ch;
        ++hash[ch - 'a'];
    }

    sort(hash.begin(),hash.end(), greater<>());

    for(int i = 0;i < b && i < 26;++i)
        if(hash[i] >= 3) a -= hash[i];

    cout << a;
}
```

---

### 缩花
[⬅️ 返回目录](#-题目跳转)

> &emsp;**💡 解题思路**
> &emsp;...