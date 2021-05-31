# inquirer-search-list

forked from [robin-rpr/inquirer-search-list](https://github.com/robin-rpr/inquirer-search-list)

增加功能：
1. 可以通过`default`指定初始化默认选中值;
2. 支持不匹配时，可以自定义输入值;

### Overview
1. [Install Guide](#install)
2. [Usage](#usage)
3. [Take a look at Examples](#examples)

![](preview.gif)

### Install

```
$ npm i @elfiner/inquirer-search-list
```

### Usage

```js
const inquirer = require("inquirer");

inquirer.registerPrompt('search-list', require('@elfiner/inquirer-search-list'));
```

### Examples

See [examples](https://github.com/XyyF/elfin-inquirer-search-list/tree/master/examples/) for detail.
