exports['notifier removeListener'] = function(test, CustomProperty){
	var notifier = CustomProperty.Notifier.new();
	var passed = false;

	function removeListener(){
		notifier.remove(removeListener);
	}

	function log(){
		passed = true;
	}

	notifier.add(removeListener);
	notifier.add(log);
	notifier.notify();

	test.equal(passed, true);
	test.equal(notifier.size, 1);
	test.done();
};

exports['can retrieve customProperty from object'] = function(test, CustomProperty){
	var parent = {};
	var object = Object.create(parent);
	var definitionA = CustomProperty.new(parent, 'foo').define();
	var definitionB = CustomProperty.new(object, 'foo').define();

	test.equal(definitionA, CustomProperty.fromObject(parent, 'foo'));
	test.equal(definitionB, CustomProperty.fromObject(object, 'foo'));
	test.done();	
};

exports['parent changes ignored once whil property is set'] = function(test, CustomProperty){
	var parent = {};
	var object = Object.create(parent);
	var definition = CustomProperty.new(object, 'name');
	var change;

	definition.addListener(function test(){ change = arguments[0]; }, 'test');
	
	object.name = 'ok';
	parent.name = 'hey';

	test.equal(change.value, 'ok');
	test.done();
};

exports['customProperty get/set right value'] = function(test, CustomProperty){
	var object = {};
	var a = Object.create(object);
	var b = Object.create(object);
	var customProperty = CustomProperty.new(object, 'name').define({});

	a.name = 'foo';
	b.name = 'bar';
	test.equal(a.name, 'foo');
	test.equal(b.name, 'bar');
	test.done();
};

exports['cache call getter on demand, even on child objects'] = function(test, CustomProperty){
	var object = {};
	var count = 0;
	var value;
	var child = Object.create(object);
	var childValue;
	var getterValue = 'foo';
	
	CustomProperty.new(object, 'cached').define({
		get: function(){
			count++;
			return getterValue;
		},
		cache: true
	});	

	test.equal(object.cached, 'foo', 'parent');
	test.equal(child.cached, 'foo', 'child');

	object.cached = 'bar';
	test.equal(object.cached, 'bar', 'parent bar');	
	test.equal(child.cached, 'bar', 'child bar');

	test.equal(count, 1);

	test.done();
};

exports['cache of composed properties invalidation'] = function(test, CustomProperty){
	var object = {firstName: 'john', lastName: 'smith'};
	var child = Object.create(object);
	var count = 0;
	var fullName;
	var definition = CustomProperty.new(object, 'fullName').define({
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
	test.equal(count, ++expectedCount, 'machefer');

	object.lastName = 'grassiot';
	child.fullName;
	test.equal(count, expectedCount, 'grassiot');

	object.fullName;
	test.equal(count, ++expectedCount); // lastName of object has been modified but child.lastName exists, cache is still valid

	test.done();
};

exports['observe + unobserve restore the property'] = function(test, CustomProperty){
	var object = {};
	function listener(){}
	var def = CustomProperty.new(object, 'name');

	def.addListener(listener);
	def.removeListener(listener);

	test.equal('name' in object, false);
	test.done();
};