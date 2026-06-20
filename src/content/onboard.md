---
title: "Publisher Onboarding Guide"
outline: [2,3]
lastUpdated: true
---

# Onboarding Guide

This guide helps publishers prepare their content for licensing through the RSL Collective, either through an Enrollment Partner or directly through the RSL Collective API.

RSL Collective licensing uses a web-native declaration and enrollment model that **significantly reduces the operational complexity of content licensing for publishers**. Publishers do not need to build custom feeds, export article databases, upload archives, or expose CMS systems. They keep content in their existing publishing workflows, publish RSL declarations on their own sites, and enroll the applicable website or subdomain roots.

The workflow has three parts:

1. The publisher defines the content it wants to make available by publishing one or more RSL files on its existing website. These files can identify a site, section, file, dataset, URL pattern, page-level exception, or syndicated copy, and declare whether that content is available under the RSL Collective License.

2. The publisher makes those RSL files discoverable through the `robots.txt` file for each applicable website or subdomain, so crawlers can find the publisher's RSL declarations using normal web infrastructure.

3. The publisher enrolls each website or subdomain root with the RSL Collective, either through an Enrollment Partner or directly through the RSL Collective API. Enrollment confirms that the publisher wants content from that website or subdomain included, has authority to license the content identified by the applicable RSL declarations, and can receive reporting and payment through the RSL Collective.

**This model works for both simple and complex publishing environments**. Publishers enroll each website or subdomain once, while their RSL files define which sections, datasets, individual files, pages, and URL patterns are included, excluded, or treated separately.

For most publishers, getting ready means:

1. Define the content to make available under the RSL Collective License.
2. Publish one or more RSL files on the publisher's website.
3. Make those RSL files discoverable through `robots.txt`.
4. Enroll each applicable website or subdomain root with the RSL Collective.
5. Keep the RSL files and enrollment information current as content, rights, and licensing boundaries change.

## Step 1: Define RSL declarations

Publishers use RSL declarations to identify the content they want to make available through RSL Collective licensing. A declaration can cover an entire website, a specific section, a dataset, an individual file, a page-level exception, syndicated content, or a pattern of URLs.

Enrollment happens at the website or subdomain level. The RSL declarations do the more detailed work: they define which content within that host is included, excluded, or treated separately. For RSL Collective licensing, each licensing declaration **must** reference the RSL Collective License in the `<standard>` element.

### Licensing an entire website

For publishers that want to include an entire site in RSL Collective licensing, the simplest approach is a single RSL file with a site-wide declaration.

```xml {2}
<rsl xmlns="https://rslstandard.org/rsl">
  <content url="/">
    <license>
      <permits type="usage">ai-all</permits>
      <payment>
        <standard>https://rslcollective.org/license</standard>
      </payment>
    </license>
  </content>
</rsl>
```

The `<content url="/">` element identifies the website root. The `<standard>` element references the RSL Collective License.

### Licensing a specific website section

A publisher can identify a specific section of a website when only that section should be made available under the RSL Collective License, or when the section needs separate treatment from the rest of the site.

```xml {1}
<content url="/original-reporting/">
  <license>
    <permits type="usage">ai-all</permits>
    <payment>
      <standard>https://rslcollective.org/license</standard>
    </payment>
  </license>
</content>
```

The `<content url="/original-reporting/">` element identifies pages and other assets whose URLs begin with `/original-reporting/`.

### Licensing matching file types or URL patterns

A publisher can use a URL pattern to identify content that matches a specific URL structure. This is useful when a publisher wants to license HTML documents or another specific class of files without also licensing related images, videos, scripts, or other assets referenced by those pages.

```xml {1}
<content url="/articles/*.html">
  <license>
    <permits type="usage">ai-all</permits>
    <payment>
      <standard>https://rslcollective.org/license</standard>
    </payment>
  </license>
</content>
```

The `<content url="/articles/*.html">` element identifies article pages whose URLs match `/articles/*.html`. Other assets used by those pages, such as images or media files, are not included unless another RSL declaration identifies them.

### Licensing specific files, datasets, or downloads

A publisher can identify an individual file, dataset, media file, or downloadable resource. This is useful when the publisher wants to license an asset that is managed separately from ordinary web pages, such as structured data, reports, EPUB files, PDFs, images, video, or archives.

```xml {1}
<content url="/datasets/market-data.csv">
  <license>
    <permits type="usage">ai-all</permits>
    <payment>
      <standard>https://rslcollective.org/license</standard>
    </payment>
  </license>
</content>
```

The `<content url="/datasets/market-data.csv">` element identifies that dataset as available under the RSL Collective License.

### Excluding specific website sections

Publishers can use a more specific RSL declaration to exclude a section from RSL Collective licensing. This is useful when content under a predictable URL path should not be included, such as syndicated articles, wire-service images, licensed video, or other externally sourced material.

For example, a publisher could make its original reporting available under the RSL Collective License while excluding a subsection used for licensed third-party photos:

```xml {1,10}
<content url="/original-reporting/">
  <license>
    <permits type="usage">ai-all</permits>
    <payment>
      <standard>https://rslcollective.org/license</standard>
    </payment>
  </license>
</content>

<content url="/original-reporting/licensed-wire-images/">
  <license>
    <prohibits type="usage">ai-all</prohibits>
  </license>
</content>
```

The first declaration identifies `/original-reporting/` as available under the RSL Collective License. The second declaration excludes the more specific `/original-reporting/licensed-wire-images/` section.

### Licensing or excluding specific pages

Publishers can manage licensing at the page level when individual pages need treatment that differs from the broader section or site. This is useful when a news section is generally available under the RSL Collective License, but specific pages contain syndicated articles, restricted photographs, sponsored material, or other content that should not be included.

A publisher could make the full news section available in its main RSL file:

```xml {1}
<content url="/news/">
  <license>
    <permits type="usage">ai-all</permits>
    <payment>
      <standard>https://rslcollective.org/license</standard>
    </payment>
  </license>
</content>
```

If a specific syndicated article appears inside that section, the publisher can use its CMS to add a page-level RSL declaration to that article. The embedded declaration applies to the current page by using an empty `url` value:

```html {3}
<script type="application/rsl+xml">
  <rsl xmlns="https://rslstandard.org/rsl">
    <content url="">
      <license>
        <prohibits type="usage">ai-all</prohibits>
      </license>
    </content>
  </rsl>
</script>
```

This tells crawlers that the individual page is not available for AI use under the broader section-level declaration. Page-level declarations let publishers manage licensing exceptions through their existing CMS workflows, without creating manual content records or building a custom integration with the RSL Collective.

### Licensing or excluding syndicated content and media

When a publisher syndicates content or media to another website, such as a news aggregator or distribution partner, an AI system that encounters the copy needs to identify the publisher that controls the licensing rights. RSL supports this by allowing the publisher to embed an RSL declaration directly in the syndicated page. The declaration includes a canonical URL that identifies the publisher as the licensing source rather than the syndicating site.

```html {4}
<head>
  <script type="application/rsl+xml">
    <rsl xmlns="https://rslstandard.org/rsl">
      <content url="https://example.com/articles/123">
        <license>
          <permits type="usage">ai-all</permits>
          <payment>
            <standard>https://rslcollective.org/license</standard>
          </payment>
        </license>
      </content>
    </rsl>
  </script>
</head>
```

In this example, the syndicated page includes an RSL declaration that points to `https://example.com/articles/123`, a URL on the publisher's website. When an AI system reads the declaration, it can identify `example.com` as the licensing source and evaluate the syndicated copy under that publisher's RSL declaration, rather than under the site where the copy appears.

The same pattern applies to syndicated media and data files. When a file may be downloaded, copied, or distributed through another channel, RSL can be embedded in the file's metadata so the file continues to identify the publisher as the licensing source.

```xml {1}
<rsl:content url="https://press.example.com/example-book.epub">
  <rsl:license>
    <rsl:permits type="usage">ai-all</rsl:permits>
    <rsl:payment>
      <rsl:standard>https://rslcollective.org/license</rsl:standard>
    </rsl:payment>
  </rsl:license>
</rsl:content>
```

In this example, the embedded RSL declaration identifies `press.example.com` as the licensing source for the EPUB, even if the file is distributed outside the publisher's own website.

Syndicated pages and media files do not need separate enrollment records. They should be identified by RSL declarations associated with the publisher's enrolled website or subdomain.

### Licensing premium or paywalled content

When content is not publicly accessible to crawlers, publishers can use RSL to license an encrypted file or archive through an RSL license server. This allows publishers to make premium archives, subscriber-only reporting, or other controlled-access material available under the RSL Collective License without exposing their CMS, subscription database, or internal access-control systems.

For example, a publisher could make an encrypted subscriber archive available under the RSL Collective License:

```xml {3-5}
<rsl xmlns="https://rslstandard.org/rsl">
  <content
    url="/subscriber/archive-2026.warc.enc"
    encrypted="true"
    server="https://api.rslcollective.org">
    <license>
      <permits type="usage">ai-all</permits>
      <payment>
        <standard>https://rslcollective.org/license</standard>
      </payment>
    </license>
  </content>
</rsl>
```

In this example, the RSL declaration identifies `/subscriber/archive-2026.warc.enc` as an encrypted subscriber archive available under the RSL Collective License. Licensed access is handled through the RSL license server, while the publisher continues to operate its existing paywall, subscription, and CMS workflows.

## Step 2: Publish RSL declarations for your content through robots.txt

For RSL Collective licensing, each applicable website or subdomain must make its RSL files discoverable through `robots.txt` by adding one or more `License:` lines that reference the applicable RSL file or files. For example:

```text
License: https://example.com/rsl.xml
License: https://example.com/rsl-premium.xml
```

Each subdomain needs its own `robots.txt` file if content on that subdomain is being licensed. If a publisher licenses content from both `www.example.com` and `news.example.com`, each host should identify the applicable RSL file from its own `robots.txt` file:

```text
https://www.example.com/robots.txt
https://news.example.com/robots.txt
```

The RSL files define which content is governed by the RSL Collective License. The `robots.txt` file tells crawlers where to find those files for the applicable website or subdomain.

## Step 3: Enroll your websites or subdomains in the RSL Collective

Enrollment identifies the websites and subdomains participating in the RSL Collective. For each website or subdomain root, you will need to provide the following information either through an Enrollment Partner or directly through the RSL Collective API:

* the root URL of the website or subdomain being enrolled
* the publisher website associated with that content
* confirmation that the publisher wants content from that website or subdomain included in RSL Collective licensing
* confirmation that the publisher has the rights or authority to include the content identified by the applicable RSL declarations
* any participating AI companies that should be excluded from access through the RSL Collective License

For example, if `https://example.com/robots.txt` links to RSL files that identify `/news/`, `/feed.xml`, and `/datasets/market-data.csv`, the publisher enrolls:

```text
https://example.com/
```

The following URLs stay in the RSL declarations and are not submitted as separate enrollment records:

```text
https://example.com/news/
https://example.com/feed.xml
https://example.com/datasets/market-data.csv
```

Those URLs are identified by the RSL declarations, not by separate enrollment records.

## Step 4: Readiness checklist

Before working with an Enrollment Partner or enrolling directly, confirm that you have:

* Published one or more RSL declarations that reference the RSL Collective License.
* Made each RSL declaration discoverable from the applicable website or subdomain through `robots.txt`.
* Identified each website or subdomain root that should be enrolled with the RSL Collective.
* Confirmed that each enrolled website or subdomain has a `robots.txt` file that links to the applicable RSL file or files.
* Confirmed that the RSL declarations identify the content to include, exclude, or treat separately.
* Identified any content that should be excluded or managed separately, such as syndicated articles, third-party media, sponsored content, premium archives, or page-level exceptions.
* Identified any participating AI companies that should not receive access to particular enrolled websites or subdomains through the RSL Collective License.
* Confirmed that you have the rights or authority needed to include the content identified by the applicable RSL declarations.
* Confirmed who will handle enrollment: your Enrollment Partner or your internal team.
