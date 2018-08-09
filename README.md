# RedditScraper
Scrape all videos and pictures off a subreddit

To change the subreddit to scrape images/pictures from, go to the code and change the line

```
// -=-=-=- ONLY CHANGE THIS -=-=-=-
const subURL = '/r/<SubredditHere>';
// -=-=-=- ONLY CHANGE THIS -=-=-=-
```

to the subreddit of your choice. You will the NodeJS interpreter at above version 8.0.0, which can be found at https://nodejs.org/

You will also need to install the `Request` module with npm.

This is just a quick 1-day project, there are probably others out there that get the job done but the few I tried didn't seem to get all of the images so I made my own just for fun.
