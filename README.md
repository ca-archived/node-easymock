# Mock Server

## Usage

        $ clone git://......
        $ cd mock-server
        $ npm link
        $ cd ~/your-mock-files
        $ mockit

We will try to release this on npm. Than the first three steps will only be:

        $ npm install -g mockit
        $ mockit

## Files
All files from the running folder are present as static files. So place anything in there and it is accessible with GET filename.

### Differentiating GET/POST/PUT/DELETE
If you want to use advanced serving features like GET/POST/PUT/DELETE or templates in json, provide files like in the example below:

        GET /items/1 => items/1_get.json
        POST /items/1 => items/1_post.json
        ...

## config.json
If you want to configure proxy or lag, create a config.json file which looks kind of like this:

        {
          "simulated-lag": 1000,
          "proxy": {
            "server": "http://yourrealapi.com",
            "default": false,
            "calls": {
              "/items/1": { "get": true, "post": false },
              "/items": false
            }
          }
        }