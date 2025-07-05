// api/scrape.js

const express = require("express");
const axios = require("axios");
const JSZip = require("jszip");
const { JSDOM } = require("jsdom");

const app = express();
app.use(express.json({ limit: "10mb" }));

app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing URL in request body" });
  }

  try {
    // Fetch the page content
    const response = await axios.get(url);
    const html = response.data;

    // Parse HTML with JSDOM
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // Example: extract all images and scripts src/hrefs + HTML content
    const zip = new JSZip();

    // Add full HTML as index.html
    zip.file("index.html", html);

    // Save all images
    const imgTags = [...document.querySelectorAll("img[src]")];
    for (const img of imgTags) {
      try {
        const src = img.src;
        const imgRes = await axios.get(src, { responseType: "arraybuffer" });
        // Use filename from URL or fallback
        const urlObj = new URL(src);
        const pathname = urlObj.pathname;
        const filename = pathname.substring(pathname.lastIndexOf("/") + 1) || "image";
        zip.file("images/" + filename, imgRes.data);
      } catch (e) {
        // skip image errors
      }
    }

    // Save all scripts
    const scriptTags = [...document.querySelectorAll("script[src]")];
    for (const script of scriptTags) {
      try {
        const src = script.src;
        const scriptRes = await axios.get(src);
        const urlObj = new URL(src);
        const pathname = urlObj.pathname;
        const filename = pathname.substring(pathname.lastIndexOf("/") + 1) || "script.js";
        zip.file("scripts/" + filename, scriptRes.data);
      } catch (e) {
        // skip script errors
      }
    }

    // Generate zip buffer
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    // Set headers to serve zip file
    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="scraped.zip"`,
      "Content-Length": zipBuffer.length,
    });

    return res.send(zipBuffer);
  } catch (err) {
    console.error("Scrape error:", err);
    return res.status(500).json({ error: "Failed to scrape URL: " + err.message });
  }
});

// Export app if needed, or start server
// For example:
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Scrape API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
