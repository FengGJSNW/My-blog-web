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