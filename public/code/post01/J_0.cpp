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