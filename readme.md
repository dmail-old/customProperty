CustomProperty
=============

Using Object.defineProperty, CustomProperty can create computed property and listen for change.

## Example

[customProperty.js](./customProperty.js) has no dependency and let you do the following : 

```javascript
var user = {firstName: 'damien', lastName: 'maillard'};

Object.defineCustomProperty(user, 'fullName', {
	subproperties: ['firstName', 'lastName'],
	get: function(firstName, lastName){
		return firstName + ' ' + lastName;
	},
	set: function(fullName){
		return fullName.split(' ');
	}
});
Object.addPropertyListener(user, 'fullName', console.log, console);

user.fullName; // 'damien maillard'
user.fullName = 'john smith'; // {type: 'updated', name: 'fullName', oldValue: 'damien maillard', value: 'John Smith', object: user}
user.firstName; // 'john'
user.lastName; // 'smith'
```

## Browser compatibility

Depends on [Object.defineProperty compat](http://kangax.github.io/es5-compat-table/#Object.defineProperty) :
 - Firefox 5+
 - Chrome 4+
 - Internet Explorer 9+
 - Opera 11.6+
 - Safari 5.1+

## Computed property

When the descriptor has an array of `subproperties` it must declare a get method, a set method or both.

```javascript
Object.defineCustomProperty(user, 'fullName', {
	subproperties: ['firstName', 'lastName'],
	get: function(firstName, lastName){ // get arguments length must be equal to subproperties.length
		return firstName + ' ' + lastName;
	},
	set: function(fullName){ // set can return an array to set the subproperties values
		return fullName.split(' ');
	}
});
```

## Caching property

A cached property must provide a get method.  
The result of the get method will be cached per object to minimize the number of call to the get method.

```javascript
var item = {};
Object.defineCustomProperty(item, 'cachedValue', {
	get: function complexGetter(){
		// a costful operation
	},
	cache: true
});

item.cachedValue; // return complexGetter.call(item)
item.cachedValue; // hit the cache
```

When you cache a computedProperty, any subproperty change will invalidate the cache.

```javascript
var user = {firstName: 'damien', lastName: 'maillard'};
Object.defineCustomProperty(user, 'fullName', {
	get: function(firstName, lastName){
		return firstName + ' ' + lastName;
	},
	cache: true
});

user.fullName; // 'damien maillard'
user.firstName = 'john'; // invalid the user 'fullName' cache
user.fullName; // 'john maillard'
user.fullName; // hit the cache
```

## Listening property changes

You can listen for a property change using `Object.addPropertyListener(object, name, fn, bind)`.

```javascript
var o = {};
var child = Object.create(o);
Object.addPropertyListener(o, 'name', function(change){ console.log(change); });

o.name = 'foo'; // {type: 'update', name: 'name', oldValue: undefined, value: 'ok', object: o}
child.name = 'bar'; // {type: 'update', name: 'name', oldValue: 'foo', value: 'bar', object: child}
```

## Listening computed property

When you listen a computed property, any subproperty changes triggers the computed property change.

```javascript
var user = {firstName: 'John', lastName: 'Smith'};
Object.defineCustomProperty(user, 'fullName', {
	subproperties: ['firstName', 'lastName'],
	get: function(firstName, lastName){
		return firstName + ' ' + lastName;
	}
});
Object.addPropertyListener(user, 'fullName', function(change){ console.log(change); });

user.firstName = 'foo'; // {type: 'updated', name: 'fullName', oldValue: 'John Smith', value: 'foo Smith', object: user};
```

## Always define the property before listening change

Object.defineCustomProperty will erase listener of the property, for example :  

```javascript
var user = {foo: 'bar'};
Object.addPropertyListener(user, 'foo', console.log, console);
Object.defineCustomProperty(user, 'foo', {cache: true, get: function(){ return 'test'; });
user.foo = 'boo'; // console.log not called
```

You must define the property then listen for changes like so :
```javascript
var user = {foo: 'bar'};
Object.defineCustomProperty(user, 'foo', {cache: true, get: function(){ return 'test'; });
Object.addPropertyListener(user, 'foo', console.log, console);
user.foo = 'boo'; // console.log is called
```

## Listening non existent property

Listening for a non existing property will define a property on the object.

```javascript
var o = {}, listener = function(){};
Object.addPropertyListener(o, 'name', listener);
'name' in o; // true
```

## API

- Object.defineCustomProperty(object, name, descriptor)
- Object.hasOwnCustomProperty(object, name)
- Object.getOwnCustomProperty(object, name)
- Object.getOwnCustomPropertyDescriptor(object, name)
- Object.addPropertyListener(object, name, fn, bind)
- Object.removePropertyListener(object, name, fn, bind)
