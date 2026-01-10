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
    if(a & 1) cout << "No";
    else cout << "Yes";
}