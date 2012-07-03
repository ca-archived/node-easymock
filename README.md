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

---------

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
          },
          "variables": {
            "server": "http://server.com"
          }
        }

### Variables
Variables that you define in your config.json can be used in files that have the _get/_post/... extension. As well you can use them in your templates.

Example to use variables. item_get.json:

        { "image": "#{server}/img.jpg" }

This will return:

        { "image": "http://server.com/img.jpg"}

---------

## Files
All files from the running folder are present as static files. So place anything in there and it is accessible with GET filename.

### Differentiating GET/POST/PUT/DELETE
If you want to use advanced serving features like GET/POST/PUT/DELETE or templates in json, provide files like in the example below:

        GET /items/1 => items/1_get.json
        POST /items/1 => items/1_post.json
        ...

---------

## Templates
If you have items that are used over and over again, you can make templates for them and reuse the same template.

For that create a folder "_templates" and in it place for example a file object.json:

        { "name": "my object" }

Then you can refer this template out of another file like items_get.json:

        [ {{object}}, {{object}}, {{object}}, {{object}} ]

This will return a array with four times the object from the template.

### Parameters

You can even use parameters. For example you have a template Object.json:

         {
            "name": "Item #{_1}",
            "image": "#{server}/img/img_#{_2}.jpg",
            "active": #{_3}
          }

And then a api object called items_get.json:

          [
            {{Object(1,one,true)}},
            {{Object(2,two,false)}},
            {{Object(3,three,true)}}
          ]

You will receive the following response:

          [
             {
                "name":"Item 1",
                "image":"http://server.com/img/img_one.jpg",
                "active":true
             },
             {
                "name":"Item 2",
                "image":"http://server.com/img/img_two.jpg",
                "active":false
             },
             {
                "name":"Item 3",
                "image":"http://server.com/img/img_three.jpg",
                "active":true
             }
          ]