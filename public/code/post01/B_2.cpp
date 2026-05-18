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
