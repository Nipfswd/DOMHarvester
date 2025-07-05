import JSZip from "jszip";
import cheerio from "cheerio";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST requests allowed" });
    return;
  }

  const { url } = req.body;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing or invalid url" });
    return;
  }

  try {
    // Fetch HTML page
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch page: ${response.status}`);

    const html = await response.text();

    // Parse HTML
    const $ = cheerio.load(html);

    // Collect resource URLs (images and css)
    const resourceUrls = [];

    $("img[src]").each((_, el) => {
      let src = $(el).attr("src");
      if (src && !src.startsWith("data:")) {
        resourceUrls.push(new URL(src, url).href);
      }
    });

    $("link[rel='stylesheet'][href]").each((_, el) => {
      let href = $(el).attr("href");
      if (href) {
        resourceUrls.push(new URL(href, url).href);
      }
    });

    // Create zip and add HTML file
    const zip = new JSZip();
    zip.file("index.html", html);

    // Fetch and add resources
    for (const resourceUrl of resourceUrls) {
      try {
        const resResource = await fetch(resourceUrl);
        if (!resResource.ok) continue;

        const buffer = await resResource.arrayBuffer();
        // Use last part of URL as filename
        const fileName = resourceUrl.split("/").pop().split("?")[0] || "file";

        zip.file(fileName, Buffer.from(buffer));
      } catch (e) {
        // Ignore resource fetch errors
        console.warn(`Failed to fetch resource: ${resourceUrl}`, e.message);
      }
    }

    // Generate zip file as buffer
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    // Set headers for file download
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="scraped_site.zip"`);
    res.status(200).send(zipBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
