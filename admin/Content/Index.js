/**
 * Created by David on 12/22/2015.
 */
/* Static express hosting of admin console */
console.log("Changing to directory" + __dirname);
process.chdir(__dirname);
console.log("Starting nulldelicious admin");
var fs = require('fs');
var express = require('express');
var app = express();
/*admin views*/
app.use('/admin', express.static('views'));
/*assets*/
app.use('/js', express.static('js'));
app.use('/css', express.static('css'));
app.use('/img', express.static('img'));
app.use('/fonts', express.static('fonts'));
/*angular directive templates */
app.use('/template', express.static('template'));
app.use('/lib', express.static('../../lib'));
app.listen(8080);
console.log("Hosting nulldelicious admin at URI:8080/admin/Index.html");
