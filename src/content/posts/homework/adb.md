---
title: 线代作业20260427
published: 2026-04-27
description: 作业
tags: [作业, ChatGPT5.5-Plus]
category: 作业
draft: false
---

##assistant

好的，我把答案改成“**short English + necessary calculation**”的版本。另：上一版里 **3.1 #2** 我写错了，正确是 det⁡\=81\\det=81det\=81。

Exercises 2.3, p.133
--------------------

**22.**  
If Hx\=cHx=cHx\=c is inconsistent for some ccc, then columns of HHH do not span Rn\\mathbb R^nRn.  
So HHH is not invertible. Hence Hx\=0Hx=0Hx\=0 has a nontrivial solution.

**23.**  
K≁In⇒KK\\not\\sim I\_n\\Rightarrow KK∼In​⇒K has fewer than nnn pivots.  
So columns of KKK are linearly dependent.

**24.**  
Lx\=0Lx=0Lx\=0 has only the trivial solution.  
So columns of LLL are linearly independent.  
Since LLL is n×nn\\times nn×n, they also span Rn\\mathbb R^nRn.

**25.**  
Suppose AB\=IAB=IAB\=I.  
Then AAA has a right inverse, so AAA is invertible.  
Multiply left by A−1A^{-1}A−1:

A−1AB\=A−1IA^{-1}AB=A^{-1}IA−1AB\=A−1I B\=A−1B=A^{-1}B\=A−1

Thus BA\=IBA=IBA\=I, and both A,BA,BA,B are invertible.

**26.**  
Columns of AAA LI ⇒A\\Rightarrow A⇒A invertible.  
Then A2\=AAA^2=AAA2\=AA is invertible.  
So columns of A2A^2A2 span Rn\\mathbb R^nRn.

**27.**  
Since ABABAB is invertible, there is WWW such that

(AB)W\=I(AB)W=I(AB)W\=I A(BW)\=IA(BW)=IA(BW)\=I

So AAA has a right inverse. Hence AAA is invertible.

**28.**  
Since ABABAB is invertible, there is WWW such that

W(AB)\=IW(AB)=IW(AB)\=I (WA)B\=I(WA)B=I(WA)B\=I

So BBB has a left inverse. Hence BBB is invertible.

**29.**  
More than one solution means Ax\=bAx=bAx\=b is not one-to-one.  
Thus AAA is not invertible.  
So the transformation is also not onto Rn\\mathbb R^nRn.

* * *

Exercises 2.4, p.139–140
------------------------

**4.**

\[I0−XI\]\[ABCD\]\=\[ABC−XAD−XB\]\\begin{bmatrix}I&0\\\\-X&I\\end{bmatrix} \\begin{bmatrix}A&B\\\\C&D\\end{bmatrix} = \\begin{bmatrix} A&B\\\\ C-XA&D-XB \\end{bmatrix}\[I−X​0I​\]\[AC​BD​\]\=\[AC−XA​BD−XB​\]

**5.**

\[ABC0\]\[I0XY\]\=\[A+BXBYC0\]\=\[0IZ0\]\\begin{bmatrix}A&B\\\\C&0\\end{bmatrix} \\begin{bmatrix}I&0\\\\X&Y\\end{bmatrix} = \\begin{bmatrix} A+BX&BY\\\\ C&0 \\end{bmatrix} = \\begin{bmatrix}0&I\\\\Z&0\\end{bmatrix}\[AC​B0​\]\[IX​0Y​\]\=\[A+BXC​BY0​\]\=\[0Z​I0​\]

So

BY\=I⇒Y\=B−1BY=I\\Rightarrow Y=B^{-1}BY\=I⇒Y\=B−1 A+BX\=0⇒X\=−B−1AA+BX=0\\Rightarrow X=-B^{-1}AA+BX\=0⇒X\=−B−1A Z\=CZ=CZ\=C

**7.**

\[X00Y0I\]\[AZ00BI\]\=\[XAXZYA+BYZ+I\]\=\[I00I\]\\begin{bmatrix}X&0&0\\\\Y&0&I\\end{bmatrix} \\begin{bmatrix}A&Z\\\\0&0\\\\B&I\\end{bmatrix} = \\begin{bmatrix} XA&XZ\\\\ YA+B&YZ+I \\end{bmatrix} = \\begin{bmatrix}I&0\\\\0&I\\end{bmatrix}\[XY​00​0I​\]​A0B​Z0I​​\=\[XAYA+B​XZYZ+I​\]\=\[I0​0I​\]

Thus

X\=A−1,Z\=0,Y\=−BA−1X=A^{-1},\\quad Z=0,\\quad Y=-BA^{-1}X\=A−1,Z\=0,Y\=−BA−1

**10.**

\[I00CI0ABI\]\[I00ZI0XYI\]\=\[I00C+ZI0A+BZ+XB+YI\]\\begin{bmatrix}I&0&0\\\\C&I&0\\\\A&B&I\\end{bmatrix} \\begin{bmatrix}I&0&0\\\\Z&I&0\\\\X&Y&I\\end{bmatrix} = \\begin{bmatrix} I&0&0\\\\ C+Z&I&0\\\\ A+BZ+X&B+Y&I \\end{bmatrix}​ICA​0IB​00I​​​IZX​0IY​00I​​\=​IC+ZA+BZ+X​0IB+Y​00I​​

So

Z\=−C,Y\=−BZ=-C,\\quad Y=-BZ\=−C,Y\=−B A+B(−C)+X\=0A+B(-C)+X=0A+B(−C)+X\=0 X\=BC−AX=BC-AX\=BC−A

**14.**  
Let

A\=\[A11A120A22\]A=\\begin{bmatrix}A\_{11}&A\_{12}\\\\0&A\_{22}\\end{bmatrix}A\=\[A11​0​A12​A22​​\]

If A11,A22A\_{11},A\_{22}A11​,A22​ are invertible, then

A−1\=\[A11−1−A11−1A12A22−10A22−1\]A^{-1}= \\begin{bmatrix} A\_{11}^{-1}&-A\_{11}^{-1}A\_{12}A\_{22}^{-1}\\\\ 0&A\_{22}^{-1} \\end{bmatrix}A−1\=\[A11−1​0​−A11−1​A12​A22−1​A22−1​​\]

Check by multiplication:

AA−1\=\[I00I\]AA^{-1}= \\begin{bmatrix}I&0\\\\0&I\\end{bmatrix}AA−1\=\[I0​0I​\]

So AAA is invertible. Conversely, if AAA is invertible, both diagonal blocks must be invertible.

**15.**

\[I0XI\]\[A1100S\]\[IY0I\]\=\[A11A11YXA11XA11Y+S\]\\begin{bmatrix}I&0\\\\X&I\\end{bmatrix} \\begin{bmatrix}A\_{11}&0\\\\0&S\\end{bmatrix} \\begin{bmatrix}I&Y\\\\0&I\\end{bmatrix} = \\begin{bmatrix} A\_{11}&A\_{11}Y\\\\ XA\_{11}&XA\_{11}Y+S \\end{bmatrix}\[IX​0I​\]\[A11​0​0S​\]\[I0​YI​\]\=\[A11​XA11​​A11​YXA11​Y+S​\]

Compare with

\[A11A12A21A22\]\\begin{bmatrix}A\_{11}&A\_{12}\\\\A\_{21}&A\_{22}\\end{bmatrix}\[A11​A21​​A12​A22​​\]

Thus

A11Y\=A12⇒Y\=A11−1A12A\_{11}Y=A\_{12}\\Rightarrow Y=A\_{11}^{-1}A\_{12}A11​Y\=A12​⇒Y\=A11−1​A12​ XA11\=A21⇒X\=A21A11−1XA\_{11}=A\_{21}\\Rightarrow X=A\_{21}A\_{11}^{-1}XA11​\=A21​⇒X\=A21​A11−1​

**24.**  
Let

Ak+1\=\[101Ak\],Bk+1\=\[10−e1Bk\]A\_{k+1}=\\begin{bmatrix}1&0\\\\\\mathbf 1&A\_k\\end{bmatrix}, \\quad B\_{k+1}=\\begin{bmatrix}1&0\\\\-e\_1&B\_k\\end{bmatrix}Ak+1​\=\[11​0Ak​​\],Bk+1​\=\[1−e1​​0Bk​​\]

Assume BkAk\=IB\_kA\_k=IBk​Ak​\=I and Bk1\=e1B\_k\\mathbf 1=e\_1Bk​1\=e1​. Then

Bk+1Ak+1\=\[10−e1+Bk1BkAk\]\=\[100I\]B\_{k+1}A\_{k+1} = \\begin{bmatrix} 1&0\\\\ -e\_1+B\_k\\mathbf1&B\_kA\_k \\end{bmatrix} = \\begin{bmatrix} 1&0\\\\ 0&I \\end{bmatrix}Bk+1​Ak+1​\=\[1−e1​+Bk​1​0Bk​Ak​​\]\=\[10​0I​\]

So Bk+1\=Ak+1−1B\_{k+1}=A\_{k+1}^{-1}Bk+1​\=Ak+1−1​. Hence B\=A−1B=A^{-1}B\=A−1.

* * *

Exercises 2.8, p.169–170
------------------------

**5.**  
Solve

c1v1+c2v2\=wc\_1v\_1+c\_2v\_2=wc1​v1​+c2​v2​\=w 2c1−4c2\=8,3c1−5c2\=22c\_1-4c\_2=8,\\quad 3c\_1-5c\_2=22c1​−4c2​\=8,3c1​−5c2​\=2

From these,

c2\=−10,c1\=−16c\_2=-10,\\quad c\_1=-16c2​\=−10,c1​\=−16

Check third row:

−5(−16)+8(−10)\=0≠−9\-5(-16)+8(-10)=0\\ne -9−5(−16)+8(−10)\=0\=−9

So w∉Span{v1,v2}w\\notin \\text{Span}\\{v\_1,v\_2\\}w∈/Span{v1​,v2​}.

**6.**  
Solve

c1v1+c2v2+c3v3\=uc\_1v\_1+c\_2v\_2+c\_3v\_3=uc1​v1​+c2​v2​+c3​v3​\=u

Row reduction gives

\[10−3001200001\]\\left\[\\begin{array}{ccc|c} 1&0&-3&0\\\\ 0&1&2&0\\\\ 0&0&0&1 \\end{array}\\right\]​100​010​−320​001​​

This is inconsistent.  
So u∉Span{v1,v2,v3}u\\notin \\text{Span}\\{v\_1,v\_2,v\_3\\}u∈/Span{v1​,v2​,v3​}.

**7.**  
a) There are 333 vectors.

b) Col A\\text{Col }ACol A has infinitely many vectors.

c)

\[A p\]∼\[107/4−9/4015/2−7/20000\]\[A\\ p\]\\sim \\begin{bmatrix} 1&0&7/4&-9/4\\\\ 0&1&5/2&-7/2\\\\ 0&0&0&0 \\end{bmatrix}\[A p\]∼​100​010​7/45/20​−9/4−7/20​​

So the system is consistent.

p\=−94v1−72v2p=-\\frac94v\_1-\\frac72v\_2p\=−49​v1​−27​v2​

Thus p∈Col Ap\\in \\text{Col }Ap∈Col A.

**8.**

\[A p\]∼\[102−501−370000\]\[A\\ p\]\\sim \\begin{bmatrix} 1&0&2&-5\\\\ 0&1&-3&7\\\\ 0&0&0&0 \\end{bmatrix}\[A p\]∼​100​010​2−30​−570​​

So

p\=−5v1+7v2p=-5v\_1+7v\_2p\=−5v1​+7v2​

Thus p∈Col Ap\\in \\text{Col }Ap∈Col A.

**9.**  
Use AAA and ppp from #7:

Ap\=\[−2−6229\]≠0Ap= \\begin{bmatrix} -2\\\\-62\\\\29 \\end{bmatrix} \\ne0Ap\=​−2−6229​​\=0

So p∉Nul Ap\\notin \\text{Nul }Ap∈/Nul A.

**10.**  
Use AAA from #8 and u\=(−2,3,1)u=(-2,3,1)u\=(−2,3,1):

Au\=\[000\]Au= \\begin{bmatrix} 0\\\\0\\\\0 \\end{bmatrix}Au\=​000​​

So u∈Nul Au\\in \\text{Nul }Au∈Nul A.

**15.**

det⁡\[510−2−3\]\=5(−3)−10(−2)\=5≠0\\det \\begin{bmatrix} 5&10\\\\ -2&-3 \\end{bmatrix} = 5(-3)-10(-2)=5\\ne0det\[5−2​10−3​\]\=5(−3)−10(−2)\=5\=0

So the vectors form a basis for R2\\mathbb R^2R2.

**16.**

det⁡\[−426−3\]\=(−4)(−3)−2(6)\=0\\det \\begin{bmatrix} -4&2\\\\ 6&-3 \\end{bmatrix} = (-4)(-3)-2(6)=0det\[−46​2−3​\]\=(−4)(−3)−2(6)\=0

So they do not form a basis.

**19.**  
There are only 222 vectors in R3\\mathbb R^3R3.  
A basis for R3\\mathbb R^3R3 needs 333 LI vectors.  
So no.

**25.**  
Pivot columns: 1,2,41,2,41,2,4.

Basis for Col A\={\[1−1−23\],\[4226\],\[−335−5\]}\\text{Basis for Col }A= \\left\\{ \\begin{bmatrix}1\\\\-1\\\\-2\\\\3\\end{bmatrix}, \\begin{bmatrix}4\\\\2\\\\2\\\\6\\end{bmatrix}, \\begin{bmatrix}-3\\\\3\\\\5\\\\-5\\end{bmatrix} \\right\\}Basis for Col A\=⎩⎨⎧​​1−1−23​​,​4226​​,​−335−5​​⎭⎬⎫​

From echelon form:

x1\=2x3−7x5,x2\=−52x3+12x5,x4\=−4x5x\_1=2x\_3-7x\_5,\\quad x\_2=-\\frac52x\_3+\\frac12x\_5,\\quad x\_4=-4x\_5x1​\=2x3​−7x5​,x2​\=−25​x3​+21​x5​,x4​\=−4x5​

Thus

Basis for Nul A\={\[4−5200\],\[−1410−82\]}\\text{Basis for Nul }A= \\left\\{ \\begin{bmatrix}4\\\\-5\\\\2\\\\0\\\\0\\end{bmatrix}, \\begin{bmatrix}-14\\\\1\\\\0\\\\-8\\\\2\\end{bmatrix} \\right\\}Basis for Nul A\=⎩⎨⎧​​4−5200​​,​−1410−82​​⎭⎬⎫​

**26.**  
Pivot columns: 1,2,41,2,41,2,4.

Basis for Col A\={\[3−2−5−2\],\[−1296\],\[3733\]}\\text{Basis for Col }A= \\left\\{ \\begin{bmatrix}3\\\\-2\\\\-5\\\\-2\\end{bmatrix}, \\begin{bmatrix}-1\\\\2\\\\9\\\\6\\end{bmatrix}, \\begin{bmatrix}3\\\\7\\\\3\\\\3\\end{bmatrix} \\right\\}Basis for Col A\=⎩⎨⎧​​3−2−5−2​​,​−1296​​,​3733​​⎭⎬⎫​

From echelon form:

x1\=−3x3−52x5,x2\=−2x3−32x5,x4\=−x5x\_1=-3x\_3-\\frac52x\_5,\\quad x\_2=-2x\_3-\\frac32x\_5,\\quad x\_4=-x\_5x1​\=−3x3​−25​x5​,x2​\=−2x3​−23​x5​,x4​\=−x5​

Thus

Basis for Nul A\={\[−3−2100\],\[−5−30−22\]}\\text{Basis for Nul }A= \\left\\{ \\begin{bmatrix}-3\\\\-2\\\\1\\\\0\\\\0\\end{bmatrix}, \\begin{bmatrix}-5\\\\-3\\\\0\\\\-2\\\\2\\end{bmatrix} \\right\\}Basis for Nul A\=⎩⎨⎧​​−3−2100​​,​−5−30−22​​⎭⎬⎫​

* * *

Exercises 2.9, p.175–177
------------------------

**2.**

x\=−1\[−21\]+3\[31\]\=\[2−1\]+\[93\]\=\[112\]x=-1\\begin{bmatrix}-2\\\\1\\end{bmatrix} +3\\begin{bmatrix}3\\\\1\\end{bmatrix} = \\begin{bmatrix}2\\\\-1\\end{bmatrix} + \\begin{bmatrix}9\\\\3\\end{bmatrix} = \\begin{bmatrix}11\\\\2\\end{bmatrix}x\=−1\[−21​\]+3\[31​\]\=\[2−1​\]+\[93​\]\=\[112​\]

**5.**  
Solve

c1\[15−3\]+c2\[−3−75\]\=\[410−7\]c\_1\\begin{bmatrix}1\\\\5\\\\-3\\end{bmatrix} +c\_2\\begin{bmatrix}-3\\\\-7\\\\5\\end{bmatrix} = \\begin{bmatrix}4\\\\10\\\\-7\\end{bmatrix}c1​​15−3​​+c2​​−3−75​​\=​410−7​​

From

c1−3c2\=4,5c1−7c2\=10c\_1-3c\_2=4,\\quad 5c\_1-7c\_2=10c1​−3c2​\=4,5c1​−7c2​\=10 c2\=−54,c1\=14c\_2=-\\frac54,\\quad c\_1=\\frac14c2​\=−45​,c1​\=41​

So

\[x\]B\=\[1/4−5/4\]\[x\]\_{\\mathcal B}= \\begin{bmatrix} 1/4\\\\ -5/4 \\end{bmatrix}\[x\]B​\=\[1/4−5/4​\]

**11.**  
Pivot columns: 1,2,41,2,41,2,4.

Basis Col A\={\[12−33\],\[25−910\],\[04−711\]}\\text{Basis Col }A= \\left\\{ \\begin{bmatrix}1\\\\2\\\\-3\\\\3\\end{bmatrix}, \\begin{bmatrix}2\\\\5\\\\-9\\\\10\\end{bmatrix}, \\begin{bmatrix}0\\\\4\\\\-7\\\\11\\end{bmatrix} \\right\\}Basis Col A\=⎩⎨⎧​​12−33​​,​25−910​​,​04−711​​⎭⎬⎫​

From rref:

x1\=9x3−5x5,x2\=−2x3+3x5,x4\=−2x5x\_1=9x\_3-5x\_5,\\quad x\_2=-2x\_3+3x\_5,\\quad x\_4=-2x\_5x1​\=9x3​−5x5​,x2​\=−2x3​+3x5​,x4​\=−2x5​ Basis Nul A\={\[9−2100\],\[−530−21\]}\\text{Basis Nul }A= \\left\\{ \\begin{bmatrix}9\\\\-2\\\\1\\\\0\\\\0\\end{bmatrix}, \\begin{bmatrix}-5\\\\3\\\\0\\\\-2\\\\1\\end{bmatrix} \\right\\}Basis Nul A\=⎩⎨⎧​​9−2100​​,​−530−21​​⎭⎬⎫​ dim⁡Col A\=3,dim⁡Nul A\=2\\dim\\text{Col }A=3,\\quad \\dim\\text{Nul }A=2dimCol A\=3,dimNul A\=2

**12.**  
Pivot columns: 1,3,51,3,51,3,5.

Basis Col A\={\[154−2\],\[−4−9−95\],\[387−6\]}\\text{Basis Col }A= \\left\\{ \\begin{bmatrix}1\\\\5\\\\4\\\\-2\\end{bmatrix}, \\begin{bmatrix}-4\\\\-9\\\\-9\\\\5\\end{bmatrix}, \\begin{bmatrix}3\\\\8\\\\7\\\\-6\\end{bmatrix} \\right\\}Basis Col A\=⎩⎨⎧​​154−2​​,​−4−9−95​​,​387−6​​⎭⎬⎫​

From echelon form:

x3\=2x4,x5\=0,x1\=−2x2+5x4x\_3=2x\_4,\\quad x\_5=0,\\quad x\_1=-2x\_2+5x\_4x3​\=2x4​,x5​\=0,x1​\=−2x2​+5x4​ Basis Nul A\={\[−21000\],\[50210\]}\\text{Basis Nul }A= \\left\\{ \\begin{bmatrix}-2\\\\1\\\\0\\\\0\\\\0\\end{bmatrix}, \\begin{bmatrix}5\\\\0\\\\2\\\\1\\\\0\\end{bmatrix} \\right\\}Basis Nul A\=⎩⎨⎧​​−21000​​,​50210​​⎭⎬⎫​ dim⁡Col A\=3,dim⁡Nul A\=2\\dim\\text{Col }A=3,\\quad \\dim\\text{Nul }A=2dimCol A\=3,dimNul A\=2

**14.**  
Put the vectors as columns. Row reduction gives pivot columns 1,21,21,2.

Basis\={\[1−1−25\],\[2−3−16\]}\\text{Basis}= \\left\\{ \\begin{bmatrix}1\\\\-1\\\\-2\\\\5\\end{bmatrix}, \\begin{bmatrix}2\\\\-3\\\\-1\\\\6\\end{bmatrix} \\right\\}Basis\=⎩⎨⎧​​1−1−25​​,​2−3−16​​⎭⎬⎫​ dim⁡\=2\\dim=2dim\=2

**21.**  
a) True. Closed under +++, scalar multiplication, and contains 000.  
b) True. Span{v1,…,vp}\=Col\[v1⋯vp\]\\text{Span}\\{v\_1,\\dots,v\_p\\}=\\text{Col}\[v\_1\\cdots v\_p\]Span{v1​,…,vp​}\=Col\[v1​⋯vp​\].  
c) False. The solution set is in Rn\\mathbb R^nRn, not Rm\\mathbb R^mRm.  
d) True. Invertible matrix columns form a basis for Rn\\mathbb R^nRn.  
e) True. Row operations preserve column dependence relations.

* * *

Exercises 3.1
-------------

**2.**

det⁡\=1∣−3031∣+4∣5−323∣\\det= 1\\begin{vmatrix}-3&0\\\\3&1\\end{vmatrix} +4\\begin{vmatrix}5&-3\\\\2&3\\end{vmatrix}det\=1​−33​01​​+4​52​−33​​ \=1(−3)+4(15+6)\=−3+84\=81\=1(-3)+4(15+6) =-3+84=81\=1(−3)+4(15+6)\=−3+84\=81

**4.**

det⁡\=1∣1142∣−2∣3122∣+4∣3124∣\\det= 1\\begin{vmatrix}1&1\\\\4&2\\end{vmatrix} -2\\begin{vmatrix}3&1\\\\2&2\\end{vmatrix} +4\\begin{vmatrix}3&1\\\\2&4\\end{vmatrix}det\=1​14​12​​−2​32​12​​+4​32​14​​ \=1(−2)−2(4)+4(10)\=−2−8+40\=30\=1(-2)-2(4)+4(10) =-2-8+40=30\=1(−2)−2(4)+4(10)\=−2−8+40\=30

**8.**

det⁡\=4∣03−25∣−1∣4335∣+2∣403−2∣\\det= 4\\begin{vmatrix}0&3\\\\-2&5\\end{vmatrix} -1\\begin{vmatrix}4&3\\\\3&5\\end{vmatrix} +2\\begin{vmatrix}4&0\\\\3&-2\\end{vmatrix}det\=4​0−2​35​​−1​43​35​​+2​43​0−2​​ \=4(6)−(20−9)+2(−8)\=24−11−16\=−3\=4(6)-(20-9)+2(-8) =24-11-16=-3\=4(6)−(20−9)+2(−8)\=24−11−16\=−3

**10.**  
Expand along row 2:

det⁡\=−3∣1−222−45205∣\\det=-3 \\begin{vmatrix} 1&-2&2\\\\ 2&-4&5\\\\ 2&0&5 \\end{vmatrix}det\=−3​122​−2−40​255​​

The 3×33\\times33×3 determinant is −4\-4−4.

det⁡\=−3(−4)\=12\\det=-3(-4)=12det\=−3(−4)\=12

**13.**  
Expand along row 2:

det⁡\=2∣403−5734−8502−300−12∣\\det=2 \\begin{vmatrix} 4&0&3&-5\\\\ 7&3&4&-8\\\\ 5&0&2&-3\\\\ 0&0&-1&2 \\end{vmatrix}det\=2​4750​0300​342−1​−5−8−32​​

This 4×44\\times44×4 determinant is 333.

det⁡\=2(3)\=6\\det=2(3)=6det\=2(3)\=6

**16.**

det⁡\=0−3∣4031∣+1∣4−534∣\\det= 0-3\\begin{vmatrix}4&0\\\\3&1\\end{vmatrix} +1\\begin{vmatrix}4&-5\\\\3&4\\end{vmatrix}det\=0−3​43​01​​+1​43​−54​​ \=−3(4)+(16+15)\=−12+31\=19\=-3(4)+(16+15) =-12+31=19\=−3(4)+(16+15)\=−12+31\=19

* * *

Exercises 3.2
-------------

**8.**  
Row reduction gives an upper triangular matrix with diagonal product −10\-10−10.  
No row swap changes sign.

det⁡\=−10\\det=-10det\=−10

**11.**  
Use row reduction:

det⁡\[34−3−1301−3−60−4368−4−1\]\=−48\\det \\begin{bmatrix} 3&4&-3&-1\\\\ 3&0&1&-3\\\\ -6&0&-4&3\\\\ 6&8&-4&-1 \\end{bmatrix} =-48det​33−66​4008​−31−4−4​−1−33−1​​\=−48

**13.**  
Expand along column 4:

det⁡\=−1∣4766−2−4−677∣+2∣2546−2−4−677∣\\det = -1 \\begin{vmatrix} 4&7&6\\\\ 6&-2&-4\\\\ -6&7&7 \\end{vmatrix} + 2 \\begin{vmatrix} 2&5&4\\\\ 6&-2&-4\\\\ -6&7&7 \\end{vmatrix}det\=−1​46−6​7−27​6−47​​+2​26−6​5−27​4−47​​ \=−1(78)+2(42)\=6\=-1(78)+2(42)=6\=−1(78)+2(42)\=6

**15.**  
Only row 3 is multiplied by 333.

det⁡\=3(7)\=21\\det=3(7)=21det\=3(7)\=21

**17.**  
Row operation:

R1→R1+R2R\_1\\to R\_1+R\_2R1​→R1​+R2​

This does not change determinant.

det⁡\=7\\det=7det\=7

**19.**  
Row operation:

R2→R1+2R2R\_2\\to R\_1+2R\_2R2​→R1​+2R2​

The repeated-row part contributes 000, so

det⁡\=2(7)\=14\\det=2(7)=14det\=2(7)\=14

**22.**

det⁡\=5∣−3−253∣−1∣1−203∣−1∣1−305∣\\det= 5\\begin{vmatrix}-3&-2\\\\5&3\\end{vmatrix} -1\\begin{vmatrix}1&-2\\\\0&3\\end{vmatrix} -1\\begin{vmatrix}1&-3\\\\0&5\\end{vmatrix}det\=5​−35​−23​​−1​10​−23​​−1​10​−35​​ \=5(1)−3−5\=−3\=5(1)-3-5=-3\=5(1)−3−5\=−3 det⁡≠0\\det\\ne0det\=0

So the matrix is invertible.

**26.**  
Use the four vectors as columns. Expand along column 4:

det⁡\=−2∣32−25−6−1−603∣\\det=-2 \\begin{vmatrix} 3&2&-2\\\\ 5&-6&-1\\\\ -6&0&3 \\end{vmatrix}det\=−2​35−6​2−60​−2−13​​ ∣32−25−6−1−603∣\=3(−18)−2(9)−2(−36)\=0\\begin{vmatrix} 3&2&-2\\\\ 5&-6&-1\\\\ -6&0&3 \\end{vmatrix} = 3(-18)-2(9)-2(-36) =0​35−6​2−60​−2−13​​\=3(−18)−2(9)−2(−36)\=0

So

det⁡\=0\\det=0det\=0

Thus the vectors are linearly dependent.

