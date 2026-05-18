#include <bits/stdc++.h>
using namespace std;

vector<int> arr, ans, vis;

void print(int mode) {
    if(mode == 0) {
        cout << "? ";
    } else {
        cout << "! ";
    }

    for(int i = 0;i < arr.size();++i) {
        cout << arr[i] << " ";
    }
    cout << endl << flush;
}

void solve() {
    int n;
    cin >> n;
    arr.assign(n, 0);
    ans.assign(n, 0);
    vis.assign(n, 0);

    for(int i = 0;i < n;++i)    arr[i] = ans[i] = i+1;

    int a = 0;
    int p = 0, ptr = 0;
    while(1) {
        if(p >= n) {p = 0; continue;}
        if(ptr >= n) {ptr = 0; continue;}
        if(ptr = p) {ptr = p + 1; continue;}
        swap(arr[p], arr[ptr]);


        int ask;
        print(0);
        cin >> ask;
        if(ask > a) {
            ans = arr;
            a = ask;
        }
    }

}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int T;
    cin >> T;

    while (T--) {
        solve();
    }
}