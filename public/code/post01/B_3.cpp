#include <bits/stdc++.h>

using namespace std;

using f80 = long double;
using u128 = unsigned __int128;
using i128 = __int128;
using u64 = unsigned long long;
using i64 = long long;
using u32 = unsigned;

constexpr int inf = 1e9;
constexpr i64 infl = 1e18;

void solve() {
    int n, k;
    cin >> n >> k;
    vector<i64> a(n + 1);
    for (int i = 1; i <= n; i++) cin >> a[i];

    vector<int> fk, g(k + 1);
    for (int i = 1; i * i <= k; i++) {
        if (k % i != 0) continue;
        fk.push_back(i);
        if (i * i != k) fk.push_back(k / i);
    }
    sort(fk.begin(), fk.end());

    vector<vector<int> > fac(fk.size());
    for (int i = 0; i < fk.size(); i++) {
        for (int j = 0; j < fk.size(); j++) {
            if (fk[j] % fk[i] != 0) continue;
            fac[j].push_back(i);
        }
        for (int j = fk[i]; j <= k; j += fk[i]) g[j] = i;
    }

    vector<int> f(k + 2);
    for (i64 i = 2; i <= k + 1; i++) {
        if (f[i]) continue;
        f[i] = i;
        for (i64 j = i * i; j <= k + 1; j += i) {
            if (!f[j]) f[j] = i;
        }
    }

    vector<vector<int> > h(fk.size());
    for (int i = 0; i < fk.size(); i++) {
        int x = k / fk[i] + 1, lx = x;
        h[i].resize(x + 1);
        vector<int> vis(x + 1);
        for (int j = 2; j * j <= x; j++) {
            if (x % j != 0) continue;
            while (x % j == 0) x /= j;
            vis[j] = true;
        }
        if (x != 1) vis[x] = true;
        for (int j = 2; j <= lx; j++) {
            if (vis[f[j]]) h[i][j] = true;
            else h[i][j] = h[i][j / f[j]];
        }
    }

    int ans = 0;
    vector<int> cnt(k + 1);
    for (int r = 1, l = 0; r <= n; r++) {
        if (a[r] <= k) {
            cnt[a[r]]++;
            for (int id: fac[g[a[r]]]) {
                if (h[id][a[r] / fk[id]]) continue;
                int val = k - a[r] + fk[id];
                while (cnt[val]) {
                    l++;
                    if (a[l] <= k) cnt[a[l]]--;
                }
            }
        }
        ans = max(ans, r - l);
    }
    cout << ans << '\n';
}

int main() {
    cin.tie(nullptr), ios::sync_with_stdio(false);

    int t = 1;
    // cin >> t;
    while (t--) {
        solve();
    }

    return 0;
}

