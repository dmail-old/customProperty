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
				var desc = Object.getOwnPropertyDescriptor(object, name);
				desc.enumerable = false;
				Object.defineProperty(proto, name, desc);
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

	/*
	very similar to Signal : https://github.com/millermedeiros/js-signals/blob/master/src/Signal.js
	*/

	var Listener = proto.create({
		fn: null,
		bind: null,
		exec: null,

		init: function(fn, bind){
			if( typeof fn == 'object' ){
				this.exec = this.execObject;
			}
			else if( typeof fn == 'function' ){
				this.exec = this.execFn;
			}

			this.fn = fn;
			this.bind = bind;
		},

		is: function(fn, bind){
			return this.fn === fn && this.bind === bind;
		},

		execObject: function(args){
			return this.fn[this.bind].apply(this.fn, args);
		},

		execFn: function(args){
			return this.fn.apply(this.bind, args);
		}
	});

	var Notifier = proto.create({
		Listener: Listener,
		size: 0,
		index: 0,
		listeners: null,
		lastIndex: null,
		args: null,

		init: function(){
			this.listeners = [];
		},

		has: function(fn, bind){
			this.lastIndex = this.listeners.length;
			while( this.lastIndex-- && !this.listeners[this.lastIndex].is(fn, bind) );
			return this.lastIndex != -1;
		},

		add: function(fn, bind){
			if( this.has(fn, bind) ){
				return false;
			}
			else{
				this.listeners.push(this.Listener.new(fn, bind));
				this.size++;
				return true;
			}
		},

		remove: function(fn, bind){
			if( this.has(fn, bind) ){
				this.listeners.splice(this.lastIndex, 1);
				this.index--;
				this.size--;
				return true;		
			}
			return false;
		},

		clear: function(){
			if( this.size !== 0 ){
				this.listeners.length = this.size = this.index = 0;
				return true;
			}
			return false;
		},

		forEach: function(fn, bind){
			this.index = 0;
			// we don't catch index and length in case removeListener is called during the loop
			while(this.index < this.size){
				fn.call(bind, this.listeners[this.index]);
				this.index++;
			}
		},

		execListener: function(listener){
			listener.exec(this.args);
		},

		notify: function(){
			this.args = arguments;
			this.forEach(this.execListener, this);
			this.args = null;
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
		Notifier: Notifier,

		object: null,
		name: null,
		oldDescriptor: null, // the old propertyDescriptor
		descriptor: null, // the customDescriptor
		propertyDescriptor: null, // the current porpertyDescriptor	
		cache: null,
		notifier: null,
		subproperties: null,
		isHeritable: true,
		parent: null,
		filterParents: [Function, Boolean, Array, Object, RegExp, Error, String, Number].map(function(o){ return o.prototype; }),
		traceChildren: !false, // by default, don't trace children to avoid garbage collection issue
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
			var parent = CustomPropertyDefinition.new(object, this.name);
			return parent;
		},

		createChild: function(object){
			var child = CustomPropertyDefinition.new(object, this.name);
			var childDescriptor = {};
			for(var key in this.descriptor ) childDescriptor[key] = this.descriptor[key];

			child.define(childDescriptor);
		
			if( this.notifier ){
				child.notifier = this.notifier;
			}

			return child;
		},

		addChild: function(object){
			var child = this.createChild(object);
			if( this.traceChildren ) this.children.push(child);
			return child;
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
					this.addChild(object).set(value, object);
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

		propertyChanged: function propertyChanged(change){
			// lorsqu'on observe la propriété il faut la recalculer dès qu'une sous propriété change
			if( this.notifier && this.notifier.size !== 0 ){
				change.object[this.name] = this.getValue(change.object);
			}
			else if( this.cache ){
				if( change.object === this.object ){
					this.cache.delete();
				}
				else{
					// le cache a changé dans un enfant
					// le cache n'est plus héritable, mais que pour cet objet
					this.addChild(change.object);
				}
			}
		},

		removeParentListener: function removeParentListener(){
			if( this.parent.parent ) this.parent.removeParentListener();
			this.parent.removeListener(this.onParentChange, this);
			this.notifier.remove(this.removeParentListener, this);
		},

		onParentChange: function onParentChange(change){
			this.removeParentListener();
			this.notifier.notify(change);
		},		

		addListener: function(fn, bind){
			if( this.notifier === null ){
				this.notifier = Notifier.new();			
			}

			if( this.descriptor === null ){ // there is no descriptor
				if( !Object.prototype.hasOwnProperty.call(this.object, this.name) ){
					var proto = Object.getPrototypeOf(this.object);
					if( proto !== null && this.filterParents.indexOf(proto) === -1 ){
						this.parent = this.fromObject(proto, this.name);
						if( this.parent === null ){
							this.parent = CustomPropertyDefinition.new(proto, this.name).define();
						}

						this.notifier.add(this.removeParentListener, this);
						// lorsque le parent change on peut supprimer la prop
						this.parent.addListener(this.onParentChange, this);
					}
				}
				
				this.define();
			}
			else if( this.descriptor.writable === false ){
				throw new TypeError(this.messages.neverChanges);
			}		

			return this.notifier.add(fn, bind);
		},

		removeListener: function(fn, bind){
			var notifier = this.notifier;
			if( notifier === null ) return false;
			if( notifier.remove(fn, bind) === false ) return false;
			// a customProperty was set to be observed, but there is no listener anymore
			if( notifier.size === 0 ) this.checkRollBack();

			return true;
		},

		fromPropertyDescriptor: function(propertyDescriptor){
			var get, customPropertyDefinition = null;

			if( 'get' in propertyDescriptor ){
				get = propertyDescriptor.get;
				if( 'customPropertyDefinition' in get ){
					customPropertyDefinition = get.customPropertyDefinition;
				}
			}

			return customPropertyDefinition;
		},

		fromObject: function(object, name){
			var propertyDescriptor = Object.getOwnPropertyDescriptor(object, name);
			if( propertyDescriptor ){
				return this.fromPropertyDescriptor(propertyDescriptor);
			}
			return null;
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
			delete propertyDescriptor.value;
			delete propertyDescriptor.writable;

			if( !('configurable' in propertyDescriptor) ) propertyDescriptor.configurable = true;

			return propertyDescriptor;
		},

		checkRollBack: function(){
			if( this.cache === null && this.subproperties === null ){
				this.rollback();
			}
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

		invalidCacheWhenSubPropertyChange: function(object, subproperties){
			subproperties.forEach(function(propertyName){
				API.addPropertyListener(object, propertyName, this.propertyChanged, this);
			}, this);
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
					this.cache = ObjectCache.new();
					if( 'value' in descriptor ){
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
			return CustomPropertyDefinition.fromObject(object, name) !== null;
		},

		getOwnCustomProperty: function(object, name){
			return CustomPropertyDefinition.fromObject(object, name);
		},

		getOwnCustomPropertyDescriptor: function(object, name){
			var property = this.getOwnCustomProperty(object, name);
			return property ? property.descriptor : null;
		},

		defineCustomProperty: function(object, name, descriptor){
			return CustomPropertyDefinition.new(object, name).define(descriptor);		
		},

		addPropertyListener: function(object, name, fn, bind){
			var customDefinition = CustomPropertyDefinition.fromObject(object, name);
			if( customDefinition === null ){
				customDefinition = CustomPropertyDefinition.new(object, name);
			}
			return customDefinition.addListener(fn, bind);	
		},

		removePropertyListener: function(object, name, fn, bind){
			var customDefinition = CustomPropertyDefinition.fromObject(object, name);
			return customDefinition ? customDefinition.removeListener(fn, bind) : false;
		}
	};

	for(var key in API){
		Object[key] = API[API[key]];
	}

	Object.CustomPropertyDefinition = CustomPropertyDefinition;

})();