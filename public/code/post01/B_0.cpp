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
}// 9