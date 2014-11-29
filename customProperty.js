/*

NOTES:
observer une propriété dans un objet apelle le listener pour les objets en héritant par prototype
observer une propriété puis redéfinir la propriété détruit les observeurs de cette propriété
	-> en résumé on peut faire defineCustomProperty() puis observeProperty
	-> mais on ne peut pas le faire dans l'ordre inverse (observeProperty puis defineCustomProperty)

A FAIRE:

*/

(function(){

	var proto = {
		create: function(object){
			var proto = Object.create(this);
			Object.getOwnPropertyNames(object).forEach(function(name){
				Object.defineProperty(proto, name, Object.getOwnPropertyDescriptor(object, name));
			});
			return proto;
		},

		new: function(){
			var instance = Object.create(this);
			if( instance.init ) instance.init.apply(instance, arguments);
			return instance;
		}
	};

	var ObjectCache = proto.create({
		object: null,
		value: undefined,
		exists: null,

		has: function(){
			return this.exists === true;
		},

		get: function(){
			return this.value;
		},

		set: function(value){
			this.exists = true;
			this.value = value;
		},

		delete: function(){
			if( this.has() ){
				this.exists = false;
				this.value = undefined;
				return true;
			}
			return false;	
		},

		clear: function(){
			this.delete();
		}
	});

	var Notifier = proto.create({
		listeners: null,
		bindings: null,
		index: null,
		lastChange: null,

		init: function(){
			this.listeners = [];
			this.bindings = [];
		},

		get size(){
			return this.listeners.length;
		},

		hasListener: function(fn, bind){
			var listeners = this.listeners, bindings = this.bindings, index = listeners.length;

			while(index--){
				if( listeners[index] === fn && bindings[index] === fn ) break;
			}

			this.index = index;

			return index;
		},

		addListener: function(fn, bind){
			if( this.hasListener(fn, bind) ){
				return false;
			}
			else{
				this.listeners.push(fn);
				this.bindings.push(bind);
				return true;
			}
		},

		removeListener: function(fn, bind){
			if( arguments.length === 0 ){
				if( this.size !== 0 ){
					this.listeners.length = this.bindings.length = 0;
					return true;
				}
			}
			else if( this.hasListener(fn, bind) ){
				this.listeners.splice(this.index, 1);
				this.bindings.splice(this.index, 1);
				return true;			
			}

			return false;
		},

		notify: function(change, listenerType){
			var listeners = this.listeners, bindings = this.bindings, i = 0, j = listeners.length, listener;

			this.lastChange = change;
			for(;i<j;i++){
				listener = listeners[i];
				if( typeof listener == 'object' ){
					listener[bindings[i]](change);
				}
				else{
					listener.call(bindings[i], change);
				}
			}

			return this;
		}
	});

	var CustomPropertyDefinition = proto.create({
		Getters: {
			computed: function(object){
				var values = this.descriptor.subproperties.map(function(name){
					return object[name];
				});

				return this.descriptor.get.apply(object, values);
			},

			accessor: function(object){
				return this.descriptor.get.call(object);
			},

			value: function(object){
				return this.descriptor.value;
			}
		},
		Setters: {
			computed: function(value, object){
				var values = this.descriptor.set.call(object, value);

				if( Array.isArray(values) && values.length != this.subproperties.length ){
					throw new TypeError(this.messages.invalidSetLength);
				}

				var i = 0, j = values.length;
				for(;i<j;i++){
					object[this.subproperties[i]] = values[i];
				}
			},

			accessor: function(value, object){
				this.descriptor.set.call(object, value);
			},

			value: function(value, object){
				this.descriptor.value = value;
			}
		},

		object: null,
		name: null,
		oldDescriptor: null, // the old propertyDescriptor
		descriptor: null, // the customDescriptor
		propertyDescriptor: null, // the current porpertyDescriptor	
		cache: null,
		notifier: null,
		isHeritable: true,
		parent: null,
		traceChildren: false, // by default, don't trace children to avoid garbage collection issue
		children: null, // array of object who inherited from this property
		messages: {
			invalidObject: 'customProperty object must be an object',
			invalidDescriptor: 'customProperty descriptor is not a non null object',
			unspecifiedGet: 'customProperty descriptor must specify when cache or subproperties is specified',
			unspecifiedAccessor: 'customeProperty must sepcify a getter or a setter when subproperties is specified',
			invalidGetLength: 'customProperty descriptor get length must be equal to subproperties.length',
			invalidSetLength: 'customProperty descriptor set must return an array with length = subproperties.length',
			neverChanges: 'customProperty descriptor onchange will never be called because writable = false',
			inextensible: 'object is not extensible'
		},

		init: function(object, name){
			if( Object(object) != object ){
				throw new TypeError(this.messages.invalidObject);
			}
			if( Object.isExtensible(object) === false ){
				throw new TypeError(this.messages.inextensible);
			}

			name = String(name);

			this.object = object;
			this.name = name;
		},

		createParent: function(object){
			var parent = this.new(object, this.name);
			return parent;
		},

		createChild: function(object){
			var child = this.new(object, this.name);
			child.define(this.assignDescriptor({}, this.descriptor));
			if( this.notifier ) child.notifier = this.notifier;
			return child;
		},

		addChild: function(object, value){
			var child = this.createChild(object);
			child.set(value, object);
			if( this.traceChildren ) this.children.push(child);
		},

		getValue: null,

		getValueGetter: function(descriptor){
			if( descriptor.get ){
				return this.Getters[this.descriptor.subproperties ? 'computed' : 'accessor'];
			}
			
			return this.Getters.value;
		},

		get: function(object){
			var value;

			if( this.cache !== null ){
				if( this.cache.has() ){
					value = this.cache.get(true);
				}
				else{
					value = this.getValue(object);
					this.cache.set(value);
				}
			}
			else{
				value = this.getValue(object);
			}

			return value;
		},

		createGetter: function(){
			var self = this;
			return function(){
				return self.get(this);
			};
		},

		setValue: null,

		getValueSetter: function(descriptor){
			if( 'set' in descriptor ){
				return this.Setters[descriptor.subproperties ? 'computed' : 'accessor'];
			}
			return this.Setters.value;
		},

		set: function(value, object){
			if( this.object !== object ){ // happen once per object because after this object got his own setter
				if( this.isHeritable ){
					this.addChild(object, value);
				}
				else{
					Object.defineProperty(object, this.name, {value: value});
				}
			}
			else{
				var notify = false, oldValue;

				if( this.notifier && this.notifier.size !== 0 ){
					oldValue = object[this.name]; // this.get(object) ne marcherais pas pour object != this.object
					if( oldValue === value ) return;
					notify = true;			
				}

				if( this.cache !== null ){
					this.cache.set(value, object);
				}
				this.setValue(value, object);
				
				if( notify ){
					this.notifier.notify({
						type: 'update',
						name: this.name,
						oldValue: oldValue,
						value: value,
						object: object
					});
				}
			}
		},

		createSetter: function(){
			var self = this;
			return function(value){
				return self.set(value, this);			
			};
		},

		propertyChanged: function(change){
			// lorsqu'on observe la propriété il faut la recalculer dès qu'une sous propriété change
			if( this.notifier && this.notifier.size !== 0 ){
				this.set(this.getValue(change.object), change.object);
			}
			else if( this.cache ){
				this.cache.delete();
			}
		},

		unobserveParent: function(){
			if( this.parent ){
				this.notifier.removeListener(this.unobserveParent, this);
				this.parent.removeListener(this.onParentChange, this);
				this.parent.unobserveParent();
				this.parent = null;
			}
		},

		onParentChange: function(change){
			this.unobserveParent();
			this.notify(change);
		},

		addListener: function(fn, bind){
			var notifier = this.notifier;

			if( notifier === null ){
				notifier = Notifier.new();
				this.notifier = notifier;			
			}

			if( this.descriptor === null ){ // there is no descriptor
				if( !Object.prototype.hasOwnProperty.call(this.object, this.name) ){
					var proto = Object.getPrototypeOf(this.object);
					if( proto ){
						this.parent = this.createParent(proto);
						this.parent.addListener(this.onParentChange, this);
						notifier.addListener(this.unobserveParent, this);
					}
				}
				this.define();
			}
			else if( this.descriptor.writable === false ){
				throw new TypeError(this.messages.neverChanges);
			}

			return notifier.addListener(fn, bind);
		},

		removeListener: function(fn, bind){
			var notifier = this.notifier;
			if( notifier === null ) return false;
			if( notifier.removeListener(fn, bind) === false ) return false;

			// a customProperty was set to be observed, but there is no listener anymore
			if( notifier.size === 0 && this.cache === null && this.subproperties === null ){
				this.rollback();
			}

			return true;
		},

		getFromPropertyDescriptor: function(propertyDescriptor){
			var get, customPropertyDefinition = null;

			if( 'get' in propertyDescriptor ){
				get = propertyDescriptor.get;
				if( 'customPropertyDefinition' in get ){
					customPropertyDefinition = get.customPropertyDefinition;
				}
			}

			return customPropertyDefinition;
		},

		setInPropertyDescriptor: function(propertyDescriptor){
			propertyDescriptor.get.customPropertyDefinition = this;
		},

		assignDescriptor: function(to, from){
			['writable', 'configurable', 'enumerable', 'value', 'set', 'get'].forEach(function(key){
				if( key in from ) to[key] = from[key];
			});
			return to;
		},

		createPropertyDescriptor: function(descriptor){
			var propertyDescriptor = this.assignDescriptor({}, descriptor);

			propertyDescriptor.get = this.createGetter();
			propertyDescriptor.set = this.createSetter();

			return propertyDescriptor;
		},

		rollback: function(){
			if( this.children ) this.children.forEach(function(child){ child.rollback(); });

			var customDescriptor = this.descriptor;

			if( !('set' in customDescriptor) && !('get' in customDescriptor) && !('value' in customDescriptor) ){
				delete this.object[this.name];
			}
			else{
				Object.defineProperty(this.object, this.name, this.assignDescriptor(this.oldDescriptor || {}, customDescriptor));
			}
		},

		invalidCacheWhenSubPropertyChange: function(){
			// todo
		},

		define: function(descriptor){
			var object = this.object, name = this.name;

			this.oldDescriptor = Object.getOwnPropertyDescriptor(object, name);

			if( arguments.length === 0 ){
				descriptor = this.oldDescriptor || {};
			}
			else{
				if( Object(descriptor) != descriptor ){
					throw new TypeError(this.messages.invalidDescriptor);
				}			
				// cache
				if( 'cache' in descriptor && descriptor.cache ){
					if( false === 'get' in descriptor ){
						throw new TypeError(this.messages.unspecifiedGet);
					}
					this.cache = ObjectCache.new(object);
					if( 'value' in descriptor ){
						delete descriptor.value;
						this.cache.set(descriptor.value);
					}
				}
				// subproperties
				if( 'subproperties' in descriptor ){
					if( 'get' in descriptor ){
						if( descriptor.subproperties.length != descriptor.get.length ){
							throw new TypeError(this.messages.invalidGetLength);
						}
					}
					else if( false === 'set' in descriptor ){
						throw new TypeError(this.messages.unspecifiedAccessor);
					}

					if( this.cache ){
						this.invalidCacheWhenSubPropertyChange(object, descriptor.subproperties);
					}
				}
			}

			if( this.isHeritable && this.traceChildren ) this.children = [];
			
			this.descriptor = descriptor;
			this.setValue = this.getValueSetter(descriptor);
			this.getValue = this.getValueGetter(descriptor);
			this.propertyDescriptor = this.createPropertyDescriptor(descriptor);		
			this.setInPropertyDescriptor(this.propertyDescriptor);
			Object.defineProperty(object, name, this.propertyDescriptor);

			return this;
		}
	});

	var API = {
		currentCustomProperty: null,

		hasOwnCustomProperty: function(object, name){
			if( Object.prototype.hasOwnProperty.call(object, name) ){
				var descriptor = Object.getOwnPropertyDescriptor(object, name);
				this.currentCustomProperty = CustomPropertyDefinition.getFromPropertyDescriptor(descriptor);
				return true;
			}

			return false;	
		},

		getOwnCustomProperty: function(object, name){
			if( this.hasOwnCustomProperty(object, name) ){
				return this.currentCustomProperty;
			}
			return null;
		},

		getOwnCustomPropertyDescriptor: function(object, name){
			var property = this.getOwnCustomProperty(object, name);
			return property ? property.descriptor : null;
		},

		defineCustomProperty: function(object, name, descriptor){
			return CustomPropertyDefinition.new(object, name).define(descriptor);		
		},

		addPropertyListener: function(object, name, fn, bind){
			var propertyDescriptor = Object.getOwnPropertyDescriptor(object, name), customDefinition;
			if( propertyDescriptor ){
				customDefinition = CustomPropertyDefinition.getFromPropertyDescriptor(propertyDescriptor);
			}
			if( customDefinition === null ){
				customDefinition = CustomPropertyDefinition.new(object, name);
			}
			return customDefinition.addListener(fn, bind);	
		},

		removePropertyListener: function(object, name, fn, bind){
			var propertyDescriptor = Object.getOwnPropertyDescriptor(object, name);
			if( propertyDescriptor === null ) return false;
			var customDefinition = CustomPropertyDefinition.getFromPropertyDescriptor(propertyDescriptor);
			if( customDefinition === null ) return false;
			return customDefinition.removeListener(fn, bind);
		}
	};

	for(var key in API){
		Object[key] = API[API[key]];
	}

	Object.CustomPropertyDefinition = CustomPropertyDefinition;

})();