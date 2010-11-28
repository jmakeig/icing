/* Copyright 2010 Justin Makeig <http://github.com/jmakeig>
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 * 		http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
/**
 * A custom event for broadcasting notifications to one or more subscribers.
 * Inspired (and probably lifted at one point) from Dave Balmer’s lean and mean Jo framework <https://github.com/davebalmer/jo>.
 * 
 * Foo = function() {
 * 	this.events = {
 * 		onAwakened: new Subject(this)
 * 	};
 * 
 * 	this.doSomething = function() {
 * 		…
 * 		this.events.onAwakened.fire("a", 2, new Date());
 * 	}
 * }
 */
Subject = function(subject) {
	this.subject = subject;
	/** Ordered list of subscriptions. */
	this.subscriptions = [];
}
Subject.prototype = {
	/**
	 * Add a subscription to an event. Subscriptions are executed in the order in which they were subscribed.
	 * @param handler The function that will be called when the event is fired
	 * @param context The object to which the handler is bound
	 * @param data Extra context data to pass to the subscription
	 */
	subscribe: function(handler, context, data) {
		var subscription = {
			"handler": handler,
			"context": context || this.subject
		}
		//if(context) subscription.context = context;
		if(data) subscription.data = data;
		this.subscriptions.push(subscription);
	},
	/**
	 * Call each of the subscriptions in the order in which they were received.
	 * @param arguments Pass through the arguments as is to the the subscriber
	 * @return Returns false and stops further processing if a subscription handler itself returns false. Otherwise undefined. 
	 */
	fire: function(/* arguments */) {
		for(var i = 0; i < this.subscriptions.length; i++) {
			var subscription = this.subscriptions[i];
			if(false === subscription.handler.apply(subscription.context || this.subject || window, arguments)) {
				return false;
			}
		}
	},
	/**
	 *	Clear subscriptions for a given context or all of them if no context is specified.
	 */
	clear: function(context) {
		var pruned = []
		if(context) {
			for(var i = 0; i < this.subscriptions.length; i++) {
				var subscription = this.subscriptions[i];
				if(context !== subscription.context) {
					pruned.push(subscription);
				}
			}
		}
		this.subscriptions = pruned;
	}
}

/**
 * A wrapper around a plain old JavaScript object that fires events when properties/constituents are modified.
 * 
 * var foo = { bar: 1, baz: ["a", "b", "c"], blah: function() { this.bar = 5; }}
 * var model = new Proxy(foo);
 * model.subscribe(function() { … }, model);
 * model.baz.set(1, "B"); // fires change
 * model.blah(55); // fires change
 * 
 * @param source The object to be proxied
 * 
 * @see http://developer.yahoo.com/yui/3/attribute/
 * @see http://github.com/jacwright/simpli5/blob/master/binding.js 
 */
Proxy = function(source) {
	var me = this;
	this.source = source;
	this.events = {
		beforeChange: new Subject(this),
		onChange: new Subject(this)
	}
	
	var beforeChangeHandler = function() { // FIXME: scope to the child object that bubbles
		return me.events.beforeChange.fire.apply(me.events.beforeChange, arguments);
	}
	var onChangeHandler = function() { // FIXME: scope to the child object that bubbles
		// From Prototype
		// TODO: Extract this out
		function update(array, args) {
		    var arrayLength = array.length, length = args.length;
		    while (length--) array[arrayLength + length] = args[length];
		    return array;
		}

		function merge(array, args) {
		    array = Array.prototype.slice.call(array, 0);
		    return update(array, args);
		}
		return me.events.onChange.fire.apply(me.events.onChange, merge(this /* The child proxy that fired the event originally */, arguments));
	}
	
	var createAccessor = function(p) {
		if(typeof source[p] !== "function") {
			var PRE = "__";
			Object.defineProperty(me, p, {
				get: function() { 
					if(me[PRE + p]) {
						return me[PRE + p];
					}
					var proxy = Proxy.create(source[p]);
					// TODO: Ugly perhaps because ArrayProxy doesn't extend Proxy
					if(proxy instanceof Proxy || proxy instanceof ArrayProxy) {
						// Subscribe to child events
						proxy.events.beforeChange.subscribe(beforeChangeHandler, proxy);
						proxy.events.onChange.subscribe(onChangeHandler, proxy);
						// Cache the proxy so the event handlers survive changes
						me[PRE + p] = proxy;
					}
					return proxy;
				},
				set: function(value) {
					//console.log("setting " + p + " to '" + value + "'");
					var before = source[p];
					if(false !== me.events.beforeChange.fire(p, before, value)) {
						source[p] = value;
						// If the new value can't be proxied, remove the cached Proxy
						if(!Proxy.canProxy(value)) {
							delete me[PRE + p];
						}
						me.events.onChange.fire(me, p, before, value);
					}
				}, 
				enumerable: true
			});
		} else {
			me[p] = function() {
				// Rewire the source function to apply to the proxy
				return source[p].apply(me, arguments);
			};
		}
	}
	for(p in source) {
		createAccessor(p);
	}
}

Proxy.create = function(source) {
	if(undefined === source) return undefined; // ?
	if(null === source) return null;
	if(ML.lang.isPrimitive(source)) {
		return source;
	}
	if(ML.lang.isArray(source)) {
		return new ArrayProxy(source);
	}
	return new Proxy(source);
}
Proxy.canProxy = function(source) {
	if(null === source) return false;
	if(undefined === source) return false;
	if(ML.lang.isPrimitive(source)) return false;
	return true;
}


ArrayProxy = function(source) {
	var PRE = "__";
	var me = this;
	// TODO: Probably should extract these into a base class
	this.source = source;
	var __proxies = new Array(this.source.length);
	this.events = {
		beforeChange: new Subject(this),
		onChange: new Subject(this)
	}
	Object.defineProperty(this, "length", {
		get: function() {
			return this.source.length;
		},
		set: function(value) {}
	});
	var beforeChangeHandler = function() { // scoped to child object that bubbles
		return me.events.beforeChange.fire.apply(me.events.beforeChange, arguments);
	}
	var onChangeHandler = function() { // scoped to child object that bubbles
		return me.events.onChange.fire.apply(me.events.onChange, arguments);
	}
	this.item = function(i) {
		if(__proxies[i]) return __proxies[i];
		var proxy = Proxy.create(this.source[i]);
		if(proxy instanceof Proxy || proxy instanceof ArrayProxy) {
			proxy.events.beforeChange.subscribe(beforeChangeHandler, proxy, {index: i});
			proxy.events.onChange.subscribe(onChangeHandler, proxy, {index: i});
			__proxies[i] = proxy;
		}
		return proxy;
	}
	this.set = function(index, value) {
		var before = this.source[index];
		if(false !== this.events.beforeChange.fire(index, before, value)) {
			this.source[index] = value;
			if(!Proxy.canProxy(value)) {
				delete __proxies[index];
			}
			this.events.onChange.fire(index, before, value);
		}
	}
	this.push = function(value) { 
		Array.prototype.push.call(this.source, value);
		this.events.onChange.fire(this.source.length - 1, undefined, value);
	},
	this.forEach = function() {
		Array.prototype.forEach.apply(this.source, arguments); // NOPE!
	}
}