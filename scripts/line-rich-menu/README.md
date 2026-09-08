# KitiButler LINE rich menu

| file | what |
| --- | --- |
| `rich-menu.json` | the 6-cell definition (2x3 grid, 2500x1686) |
| `rich-menu.jpg` | the menu image, 2500x1686, ~230 KB |
| `rich-menu-source.png` | the original generated art (1536x1024), kept for re-crops |
| `deploy.mjs` | uploads the menu and sets it as the default for all users |

## Cells

| position | label | action |
| --- | --- | --- |
| top left | หน้าหลัก | open `kitibutler.vercel.app/` |
| top middle | งานทั้งหมด | open `/tasks` |
| top right | ปฏิทิน | open `/calendar` |
| bottom left | คลังไฟล์ | open `/locker` |
| bottom middle | สร้างงาน | sends `#งาน` — bot replies with the create-task template |
| bottom right | วิธีใช้งาน | sends `เมนู` — bot replies with the full command list |

The two `message` cells send text as the user; the bot answers with a
reply message (free and unmetered on every LINE plan).

## Deploy

Needs the Messaging API channel access token: LINE Developers console ->
your Messaging API channel -> "Messaging API" tab -> Channel access token.
Same value as the `LINE_CHANNEL_ACCESS_TOKEN` Edge Function secret.

```
LINE_CHANNEL_ACCESS_TOKEN=xxxxx node scripts/line-rich-menu/deploy.mjs
```

Optional: `APP_URL=https://staging.example.com` rewrites the origin of the
four web links before upload.

The script removes any existing rich menu first, so re-running replaces
it cleanly. To change the image or the cells, edit the files and run it
again.

## Notes

- The four web links open in LINE's in-app browser. A family member who
  has not signed in with LINE yet lands on the sign-in screen first.
- `/help` (the link the `เมนู` reply points to) is the one page that
  opens without signing in.
- To regenerate `rich-menu.jpg` from a new source image:
  `ffmpeg -y -i rich-menu-source.png -vf scale=2500:1686:flags=lanczos -q:v 3 rich-menu.jpg`
