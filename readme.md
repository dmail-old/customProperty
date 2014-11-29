CustomProperty
=============

Using es5 Object.defineProperty, customProperty allow to create computed property, cached property and listen for property change.

## Example

```javascript
var user = {firstName: 'damien', lastName: 'maillard'};

Object.defineCustomProperty(user, 'fullName', {
	subproperties: ['firstName', 'lastName'],
	get: function(firstName, lastName){
		return firstName + ' ' + lastName;
	},
	set: function(fullName){
		return fullName.split(' ');
	},
	cached: true
});

user.fullName; // 'damien maillard'
user.fullName = 'John Smith';
user.firstName; // 'John'
user.lastName; // 'Smith'
```

## Computed property

When the descriptor has an array of `subproperties` it must declare at least a get or set method.  
The get method must have the same number of arguments than the subproperties array.  
The set method can return an array, in this case the subpropertiy value will be set with the array returned.  

## Cached property

A cached property will call the get method once.  
Combined with computedProperty the cache will be invalidated when a subproperty changes.  

## Listening property changes

You can listen for a property change using `Object.addPropertyListener(object, name, fn, bind)` & `Object.removePropertyListener(object, name, fn, bind)`. 

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

## Warning on listening over a non existent property

Listening for a non existing property will define a property on the object.

```javascript
var o = {}, listener = function(){};
Object.addPropertyListener(o, 'name', listener);
'name' in o; // true
```

But removing all listeners will restore object state.

```
Object.removePropertyListener(o, 'name', listener);
'name' in o; // false
```


