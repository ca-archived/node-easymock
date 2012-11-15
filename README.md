# EasyMock Server

## Usage

        $ npm install -g easymock
        $ easymock

---------

## Files
All files from the running folder are present as static files. So place anything in there and it is accessible with GET filename.

### Differentiating GET/POST/PUT/DELETE
If you want to use advanced serving features like GET/POST/PUT/DELETE or templates in json, provide files like in the example below:

        GET /items/1 => items/1_get.json
        POST /items/1 => items/1_post.json
        ...

---------

## config.json
If you want to configure routes, proxy or lag, create a config.json file which looks kind of like this:

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
          },
          "routes": [
            "/user/:userid",
            "/user/:userid/profile",
            "/user/:userid/inbox/:messageid"
          ]
        }

### Variables
Variables that you define in your config.json can be used in files that have the _get/_post/... extension. As well you can use them in your templates.

Example to use variables. item_get.json:

        { "image": "#{server}/img.jpg" }

This will return:

        { "image": "http://server.com/img.jpg"}

### Routes
The routes defined in the config.xml will get mapped to one corresponding file in which the given name will be available as a variable.

With the above confix.xml a call to GET /user/1234 would get mapped to the file: /user/userid_get.json. Inside that file one could write:

    { "id": #{userid} }

If this is the file, the result would be ```{ "userid": 1234 }```

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

## Run tests

    make tests