# Password Setup for Hidden Blog Posts

## How to Change the Password

1. Open the `.env` file in your project root
2. Change the value of `BLOG_PASSWORD` to your desired password
3. Save the file
4. Restart your development server (`npm run dev`)

Example:
```
BLOG_PASSWORD=my-super-secret-password-123
```

## How It Works

1. **Click the sun icon** in the navigation bar
2. **Enter the password** when prompted
3. **Hidden blog posts** (marked with `hidden: True` in frontmatter) will become visible
4. **Authentication persists** across browser sessions
5. **Click the sun again** to hide hidden posts

## Features

- ✅ **Password protection** for hidden blog posts
- ✅ **Persistent authentication** (remembers login across sessions)
- ✅ **Visual indicator** (🔓 icon when authenticated)
- ✅ **Easy toggle** (click sun to show/hide hidden posts)
- ✅ **Responsive modal** with proper styling
- ✅ **Keyboard support** (Enter key to submit)

## Security Features

- ✅ **Server-side validation** - Password is never exposed in client code
- ✅ **Environment variable** - Password stored securely in `.env` file
- ✅ **Git ignored** - `.env` file is not committed to version control
- ✅ **API endpoint** - Secure server-side password validation

## Files Created

- `.env` - Contains your password (not committed to git)
- `.env.example` - Template for setting up the password
- `src/routes/api/auth/+server.ts` - Server-side authentication endpoint

## Example Hidden Post

To mark a blog post as hidden, add this to the frontmatter:

```yaml
---
title: Your Hidden Post Title
description: This post is hidden by default
date: Dec 14, 2021
authors: Your Name
language: English
hidden: True
---
```
