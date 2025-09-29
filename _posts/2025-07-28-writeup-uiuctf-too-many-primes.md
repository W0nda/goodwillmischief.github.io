---
title: "UIUCTF 2025 - Too many primes"
date: 2025-07-28 20:00:00 +0200
categories: [UIUCTF 2025, crypto]
tags: [Crypto]
layout: post
description: Writeup for the challenge "Too many primes" from the UIUCTF of 2025
---

For this challenge, we got a chal.py file :

``` python
from sympy import nextprime, randprime
from sympy.core.random import seed
from math import prod, gcd
from Crypto.Util.number import bytes_to_long
# from secret import phi_N, FLAG

p = randprime(2**127, 2**128)
N = 1
while N < 2**2048:
	N *= p
	p = nextprime(p)

assert gcd(phi_N, 65537) == 1

pt = bytes_to_long(FLAG)
ct = pow(pt, 65537, N)
print("N = ", N)
print("ct = ", ct)
# N =  34546497157207880069779144631831207265231460152307441189118439470134817451040294541962595051467936974790601780839436065863454184794926578999811185968827621504669046850175311261350438632559611677118618395111752688984295293397503841637367784035822653287838715174342087466343269494566788538464938933299114092019991832564114273938460700654437085781899023664719672163757553413657400329448277666114244272477880443449956274432819386599220473627937756892769036756739782458027074917177880632030971535617166334834428052274726261358463237730801653954955468059535321422372540832976374412080012294606011959366354423175476529937084540290714443009720519542526593306377
# ct =  32130352215164271133656346574994403191937804418876038099987899285740425918388836116548661879290345302496993945260385667068119439335225069147290926613613587179935141225832632053477195949276266017803704033127818390923119631817988517430076207710598936487746774260037498876812355794218544860496013734298330171440331211616461602762715807324092281416443801588831683678783343566735253424635251726943301306358608040892601269751843002396424155187122218294625157913902839943220894690617817051114073999655942113004066418001260441287880247349603218620539692362737971711719433735307458772641705989685797383263412327068222383880346012169152962953918108171850055943194
```
{: file="chal.py"}


### Analyzing the code

After a quick view, it's clear that we need to decrypt the cphertext ```ct``` to obtain the plaintext ```pt``` which is the flag.

We see that we have an implementation of RSA.
I'll do a quick reminder of the basics of RSA to fully understand the solve, feel free to skip this step if you feel comfortable with it.

### RSA ?

RSA is an asymmetric cryptography algorithm. That means that we have to things : a private key and a public key.
In short, the public key is used to encrypt while the private key is used to decrypt.
Obviously, everyone know the public key and can encrypt data with it. This data can only be decrypted with the private key linked with the public key that encrypted the data (that's why it should be private).

In RSA, the public key is composed of 2 numbers : N and e (modulus and exponent). This numbers are used to encrypt the data.
The private key is composed by (usually) 3 numbers : p, q, and e. The particularity is that p and q are primes and furthermore ```p*q = N```.

e is in the majority of the implementations equal to 65537.

Note : The private key can contain more than 2 primes...

So for an attacker, the goal is to retrieve the primes (p and q) from the modulus (N) to obtain the private key. This is called factorization. 
For example, if N = 21, you should be able to retrieve p and q (3 and 7 because 3*7 = 21).
But in real case N is much larger so retrieving p and q should be impossible.

### The problem

We see in the code that N is constructed by multiplying multiple primes together, not just 2. Furthermore, this primes are relatively small : the first one is beetween 127 and 128 bits long and the others are the next primes following.
Knowing that, we can say that ```N = p1*p2*p3*p4*p5*...``` with all the primes being around 128 bits long, which is not so large.
We can use a tool called [factordb.com](https://factordb.com). Just input N and it will give us the factorization of N. We see 17 numbers that are really close and all 39 digits long. This is looking great, we have the primes that are composing N, we can decrypt the message !

``` python
from math import prod
from Crypto.Util.number import inverse, long_to_bytes

# Exponent
e = 65537

# Provided ciphertext
ct = 32130352215164271133656346574994403191937804418876038099987899285740425918388836116548661879290345302496993945260385667068119439335225069147290926613613587179935141225832632053477195949276266017803704033127818390923119631817988517430076207710598936487746774260037498876812355794218544860496013734298330171440331211616461602762715807324092281416443801588831683678783343566735253424635251726943301306358608040892601269751843002396424155187122218294625157913902839943220894690617817051114073999655942113004066418001260441287880247349603218620539692362737971711719433735307458772641705989685797383263412327068222383880346012169152962953918108171850055943194

# List of prime factors
factors = [
    242444312856123694689611504831894230373,
    242444312856123694689611504831894230549,
    242444312856123694689611504831894231099,
    242444312856123694689611504831894231213,
    242444312856123694689611504831894231453,
    242444312856123694689611504831894231467,
    242444312856123694689611504831894231587,
    242444312856123694689611504831894231653,
    242444312856123694689611504831894231761,
    242444312856123694689611504831894231779,
    242444312856123694689611504831894231927,
    242444312856123694689611504831894232161,
    242444312856123694689611504831894232301,
    242444312856123694689611504831894232523,
    242444312856123694689611504831894232581,
    242444312856123694689611504831894232599,
    242444312856123694689611504831894232623
]

# Reconstruct N
N = prod(factors)

# Compute phi(N)
phi_N = prod(p - 1 for p in factors)

# Compute the private exponent
d = inverse(e, phi_N)

# Decrypt
pt = pow(ct, d, N)
flag = long_to_bytes(pt)

print("FLAG = ", flag.decode(errors='ignore'))

```
{: file="solve.py"}


Note that choosing multiple (and small !) primes for RSA is a really bad idea since it increase the chance of N to be factorizable and the attack surface.

<i>Solved by <span class="goodwill">OuahLePleutre</span></i>

<div class="secret-bar">
    <div class="scrolling-text">
    	 <div class="mischief">
0x410AA6D86ACE6b208236afE753B45c119EdD43E3 (1 ETH to win !)
	</div>
    </div>
</div>