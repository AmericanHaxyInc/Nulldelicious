/**
 * Created by David on 3/29/2017.
 */
var underscore = require('underscore');
var _ = underscore;

var validParameterTypes = ['js', 'css', 'html'];


class TemplateParameter
{
    constructor(params)
    {
        this.type = params.type;
        this.validateType();
        this.text = params.text;
        this.order = params.order;
    }
    validateType(){
            var value = this.type;
            if(!_.contains(validParameterTypes, value))
            {
                throw new Error("value ${value} is an invalid parameter type for a TemplateParameter");
            }
        }
    static placeholder(){
        return "parameter${this.order}";
    }
}
class CoreTemplate
{
    constructor(params)
    {
        this.text = params.text;
        //every template contains a number of parameters
        this.parameters = params.parameters;
    }
    /*renders a template based off of its text and template parameters*/
    /*we use angular brackets and special syntax to denote parameter substitutions*/
    renderTemplate (){
        //for each parameter, replace its corresponding portion of the text and expand.
        var amendedText = this.text;
        _.each(this.parameters, function(parameter)
        {
            amendedText = this.text.replace(parameter.placeholder(), parameter.text);
        });
        return amendedText;
    }
    generateNextParameter(type, text)
    {
        var maxOrder = _.max(this.parameters, function(templateParam){return templateParam.order;});
        var nextOrder = maxOrder + 1;
        return new TemplateParameter({type: type, text: text, order: nextOrder});
    }
    insertNextParameter(type, text)
    {
        var parameter = generateNextParameter(type, text);
        this.parameters.push(parameter);
    }
}
