/**
 * Created by David on 9/30/2015.
 */
var readline = require('readline');
var hx$ = require('../HaxyClosures.js');
var crypto = require('crypto');
var uuid = require('node-uuid');
var rsa = require('node-rsa');

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
var GenerateSHA256 = (function()
{
    rl.question('Enter in a value to hash with SHA 256:', function(plaintext)
    {
        var hash = crypto.createHash('sha256');
        //pass our string to the hash
        hash.update(plaintext);
        //now return the digest
        console.log('plaintext:' + plaintext);
        console.log(hash.digest('hex'));
        rl.close();
    });
});

var GenerateUUID = (function()
{
    var result = uuid.v4();
    console.log('uuid is:' + result);
    rl.close();
});

var GeneratePrivateKey = (function()
{
    var result = new rsa({b: 512}).exportKey('pkcs1');
    console.log('private key is:' + result);
    rl.close();
});


var options = {
    '0' : ['Generate SHA256 password', GenerateSHA256],
    '1' : ['Generate UUID', GenerateUUID],
    '2' : ['Generate RSA256 private key', GeneratePrivateKey]
};

//display prompts
for(var element in options) {
    if(options.hasOwnProperty(element)) {
        console.log(element + ':' + options[element][0]);
    }
}

rl.question('Please choose an option:', function(result)
{
    if(options[result] !== undefined) {
        options[result][1]();
    }
});


