time-approver
=============

electron shell

### Usage:

1. clone
2. `npm install`
3. `grunt`
1. open the electron.exe inside the build folder for windows or the electron.app on OS X

### Configuration:

add a `.timeConfig.json` to your users home, i.e. "\Users\someguy" and add the employees you want to approve.  Here is an example:

```
{
  "email": "your@email.com",
  "password": "xxxxxxxxxx",
  "employees": [
     "Last, First",
     "Last, Second"
  ],
  "me": "Doe, John"
}
```

It is a JSON file and you can find online editors if you need to edit it there. http://www.jsoneditoronline.org/
