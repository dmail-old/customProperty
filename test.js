exports['notifier removeListener'] = function(test){
	var notifier = test.imports.Notifier.new();
	var passed = false;

	function removeListener(){
		notifier.removeListener(removeListener);
	}

	function log(){
		passed = true;
	}

	notifier.addListener(removeListener);
	notifier.addListener(log);
	notifier.notify();

	test.equal(passed, true);
	test.equal(notifier.size, 1);
	test.done();
};

exports['can retrieve customProperty from object'] = function(test){
	var parent = {};
	var object = Object.create(parent);
	var definitionA = test.imports.new(parent, 'foo').define();
	var definitionB = test.imports.new(object, 'foo').define();

	test.equal(definitionA, test.imports.getFromObject(parent, 'foo'));
	test.equal(definitionB, test.imports.getFromObject(object, 'foo'));
	test.done();	
};

exports['parent changes ignored once whil property is set'] = function(test){
	var parent = {};
	var object = Object.create(parent);
	var definition = test.imports.new(object, 'name');
	var change;

	definition.addListener(function test(){ change = arguments[0]; }, 'test');

	console.log(definition);
	
	object.name = 'ok';
	parent.name = 'hey';

	test.equal(change.value, 'ok');
	test.done();
};

exports['customProperty get/set right value'] = function(test){
	var object = {};
	var a = Object.create(object);
	var b = Object.create(object);
	var customProperty = test.imports.new(object, 'name').define({});

	a.name = 'foo';
	b.name = 'bar';
	test.equal(a.name, 'foo');
	test.equal(b.name, 'bar');
	test.done();
};

exports['cache call getter on demand, even on child objects'] = function(test){
	var object = {};
	var count = 0;
	var value;
	var child = Object.create(object);
	var childValue;
	var getterValue = 'foo';
	
	test.imports.new(object, 'cached').define({
		get: function(){
			count++;
			return getterValue;
		},
		cache: true
	});

	value = object.cached;
	value = object.cached;
	childValue = child.cached;
	object.cached = 'bar';

	test.equal(value, getterValue);	
	test.equal(childValue, getterValue);
	test.equal(child.cached, 'bar');
	test.equal(count, 1);

	test.done();
};

exports['cache of composed properties invalidation'] = function(test){
	var object = {firstName: 'john', lastName: 'smith'};
	var child = Object.create(object);
	var count = 0;
	var fullName;
	var definition = test.imports.new(object, 'fullName').define({
		subproperties: ['firstName', 'lastName'],
		get: function(firstName, lastName){
			count++;
			return firstName + ' ' + lastName;
		},
		cache: true
	});

	var expectedCount = 1;

	object.fullName;
	test.equal(count, expectedCount);
	child.fullName;
	test.equal(count, expectedCount);

	object.firstName = 'sandra';
	child.fullName;
	test.equal(count, ++expectedCount); // firstName of object has been modified, cache for child & object for 'fullName' expires

	child.lastName = 'machefer';
	child.fullName;
	test.equal(count, ++expectedCount); // ça fail, je suppose savoir pourquoi

	object.lastName = 'grassiot';
	child.fullName;
	test.equal(count, expectedCount);
	object.fullName;
	test.equal(count, ++expectedCount); // lastName of object has been modified but child.lastName exists, cache is still valid

	test.done();
};

exports['observe + unobserve restore the property'] = function(test){
	var object = {};
	var child = Object.create(object);
	var listener = function(){};
	var def = test.imports.new(object, 'name');

	def.addListener(listener);
	object.name = 'foo';
	def.removeListener(listener);

	test.equal('name' in child, false);
	test.equal(object.name, 'foo');
	test.done();
};