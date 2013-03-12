# EasyMock Server

## Usage

        $ npm install -g easymock
        $ easymock



## Files
All files from the running folder are present as static files. So place anything in there and it is accessible with GET filename.

### Differentiating GET/POST/PUT/DELETE
If you want to use advanced serving features like GET/POST/PUT/DELETE or templates in json, provide files like in the example below:

        GET /items/1 => items/1_get.json
        POST /items/1 => items/1_post.json
        ...



## config.json
If you want to configure routes, proxy or lag, create a config.json file which looks kind of like this:

        {
          "simulated-lag": 1000,
          "cors": false,
          "jsonp": false,
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
The routes defined in the config.json will get mapped to one corresponding file in which the given name will be available as a variable.

With the above config.json a call to GET /user/1234 would get mapped to the file: /user/userid_get.json. Inside that file one could write:

    { "id": #{userid} }

If this is the file, the result would be ```{ "userid": 1234 }```



## Templates
If you have items that are used over and over again, you can make templates for them and reuse the same template.

For that create a folder "_templates" and in it place for example a file object.json:

        { "name": "my object" }

Then you can refer this template out of another file like items_get.json:

        [ "{{object}}", "{{object}}", "{{object}}", "{{object}}"" ]

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
            "{{Object(1,one,true)}}",
            "{{Object(2,two,false)}}",
            "{{Object(3,three,true)}}"
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



## Response headers
You can specify the status code for the response with @status and add headers with @header. The following example is for doing a redirect response.

    < @status 301
    < @header Location: http://www.cyberagent.co.jp



## Documentation
easymock automatically documents the API it represents. This documentation can be extended by adding additional information like description, input info and output info to the json file. This is an example on how to do that for example in test_post.json:

    # This is some documentation
    # This call creates an object
    > Parameters:
    > - name
    > - description (optional)
    < @status 200
    < @header Content-Type: application/json
    {
      "id": 1234,
      "name": "your name",
      "description": "your description"
    }



## CORS and JSONP
Can be enabled by setting either "jsonp" or "cors" or both to true in the config.json.



## Run tests

    make tests



## License

    (MIT License)

    Copyright (C) 2012 CyberAgent

    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.