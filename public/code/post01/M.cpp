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