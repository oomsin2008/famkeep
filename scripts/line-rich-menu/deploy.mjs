// Deploy the KitiButler LINE rich menu: remove existing menus, create this one,
// upload its image, set it as the default for every user.
//
// Usage:
//   LINE_CHANNEL_ACCESS_TOKEN=xxxx node scripts/line-rich-menu/deploy.mjs
//
// Optional:
//   APP_URL=https://example.com   rewrites the origin of the four web links

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error(
    "Set LINE_CHANNEL_ACCESS_TOKEN (Messaging API channel access token).",
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const API = "https://api.line.me/v2/bot";
const DATA_API = "https://api-data.line.me/v2/bot";
const auth = { Authorization: `Bearer ${TOKEN}` };

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...auth, ...(init.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${body}`);
  }
  return body ? JSON.parse(body) : {};
}

async function main() {
  const menu = JSON.parse(await readFile(join(here, "rich-menu.json"), "utf8"));

  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  if (appUrl) {
    for (const area of menu.areas) {
      if (area.action?.type === "uri" && area.action.uri) {
        area.action.uri = area.action.uri.replace(
          /^https?:\/\/[^/]+/,
          appUrl,
        );
      }
    }
  }

  const { richmenus = [] } = await api("/richmenu/list");
  for (const rm of richmenus) {
    await api(`/richmenu/${rm.richMenuId}`, { method: "DELETE" });
    console.log(`removed old rich menu ${rm.richMenuId}`);
  }

  const { richMenuId } = await api("/richmenu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(menu),
  });
  console.log(`created rich menu ${richMenuId}`);

  const image = await readFile(join(here, "rich-menu.jpg"));
  const upload = await fetch(`${DATA_API}/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "image/jpeg" },
    body: image,
  });
  if (!upload.ok) {
    throw new Error(`image upload -> ${upload.status} ${await upload.text()}`);
  }
  console.log("uploaded image");

  await api(`/user/all/richmenu/${richMenuId}`, { method: "POST" });
  console.log("set as the default rich menu for all users");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
