# imgscrape: scrape images from popular internet search engines

imgscrape is a pretty simple puppeteer based image webscraper with a yargs based CLI interface. It was written quickly
to meet a machine learning project need. As such, it is not the best example of robust extensible software at the
moment. Node and Javascript are also not the languages I use most on a daily basis, so the code may not be idiomatic
or optimized Node code. I had considered writing this the Python port of puppeteer, pyppeteer, but thought better of it
given how simple this ended up being. The main logic is all in the lib/scrapeImages.js file.

It supports a few popular search engines that support image search. These can be found in the engine section of the
config/data.json file. Currently, that is: duckduckgo, yandex, infospace (not working), bing, google, flickr, instagram.
Provided the overall logic is similar to the other engines it should be relatively easy for folks that are familiar with
puppeteer to add / fix engines in the engine switch portion of the lib/scrapeImages.js file. Adding engines for search
services that behave fundamentally different from the supported ones (viz., infospace and the source code comment)
is probably not going to be easy without refactoring the code.

imgscrape support -h / --help options and the main functionality, imgscrape scrape, does as well with a few example
usages. Usage will result in a directory being created to drop the output into. That output consists of the images of
interest and a few json files that detail the duplicate URLs encountered, the URLs that the scraper failed to download
an image from, and those URLs it successfully downloaded an image from.

For those that just want to use this as a tool, because it wasn't clear to me immediately how to just install this
and do that, it's as simple as, for instance, the following

    npx imgscrape-cli -t narwhal -e google

There is logic in there to bail if the engine is not providing additional images on scrolling down the page, and a MD5
hash based check to bail on the downloading of new images if the engine is providing too many consecutive duplicate
images. There may be better ways to implement this logic, but it worked well enough for what I was trying to do.

# Caveat Utilitor

CSS selector based website scraping is brittle. Many of these services seem to change up their use of CSS classes and
ids potentially in an effort to break these types of tools or just as a side effect of normal software refactoring.
As of 4/18/2021, verified working on all engines to some degree (again except infospace).

Doing this sort of thing may also break ToS if that is a concern check before using.

This is using the search engines to find URLs and looks no different from performing a term search for images to the
search engine itself. Since the images are dispersed around the internet a rotating proxy is probably not needed;
however, it should be easy enough to rough in a proxy since puppeteer supports that natively but since I do not have
access to one I did not add that myself.

# Future

An image data set collection tip I came across a while back (unfortunately do not remember the attribution) was to
translate the terms you were looking for into foreign languages to do additional searches which can provide a
significant lift (based on my own empirical observations). To that end integrating Google Translation
service is planned but not implemented. In the meantime manually adding custom translations to the config/data.json
translation block is a workaround.

There is also a TODO.md that has a few ideas I jotted down while throwing this together with some ideas for future
improvements.
