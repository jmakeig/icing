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
 
/* FIREFOX
var o = { p: "p", q: ["q1", "q2"] }
o.watch("q", function() {
	console.log("changed");
});
o.q = [];
*/

TESTSUITE = function() {
	console.log("Running tests…");
	/**
	 * Dummy function that is a sink for any and all events. Keeps
	 * track of events in the 
	 * 
	 * @param events<Array> The array to which the event is written
	 */
	function eventLogger(events) {
		return function() {
			events.push({
				context: this,
				args: Array.prototype.slice.call(arguments)
			});
		}
	}
	/**
	 * Dummy event handler that returns false. Good for testing beforeCancel.
	 */
	function eventCancel() {return false;}
	
	/**
	 * Get a rich (enough) JavaScript object
	 */
	function dummyModel() {
		return {
			title: "name1",
			description: "description1",
			owner: null,
			product: {
				name: "MarkLogic Server",
				version: "4.2-1"
			},
			tags: ["security", "standards"]
		}
	}
	(function() {
		var events = [], counter = 0, h = eventLogger(events);
		
		var rfe = dummyModel();
		var model = new Proxy(rfe);
		
		model.events.onChange.subscribe(h.bind(model));
		
		console.assert(rfe.title === model.title && model.title === "name1");
		//console.log([rfe.name, model.name, "name1"].join("\n"));
		
		model.title = "another new name";
		console.assert(rfe.title === model.title && model.title === "another new name");
		console.assert(events.length === ++counter);
	
		model.owner = "jmakeig";
		console.assert(rfe.owner === model.owner && model.owner === "jmakeig");
		console.assert(events.length === ++counter);
	})();
	
	(function(){
		var events = [], counter = 0, h = eventLogger(events);
		var obj = {
			a: "asdf",
			// Check the scope of a proxied function
			b: function() { console.assert(this instanceof Proxy); return this; },
			c: new Date(),
			e: 44,
			f: { a: "asdf" },
			g: function(value) {
				// The Proxy rewires functions to apply to the proxy and 
				this.e = value;
			},
			h: function() {
				// Can proxied functions call other proxied functions?
				console.assert(typeof this.b === "function");
				return this.b();
			}
		}
		var model = new Proxy(obj);
		console.assert(typeof model.g === "function", "model.g is %s", typeof model.g);
		model.events.onChange.subscribe(h.bind(model));
		console.assert(model.b() === model);
		console.assert(events.length === 0);
		model.g("new value");
		console.assert(model.e === "new value", "model.e is %s", model.e);
		console.assert(events.length === 1);
		console.assert(model.source.e === "new value");
		console.assert(model.h() === model);
	})();
	
	(function() {
		var events = [], counter = 0, h = eventLogger(events);
		
		var rfe = dummyModel();
		var model = new Proxy(rfe);
		
		model.events.onChange.subscribe(h.bind(model));
		var product = model.product;
		console.assert(product.constructor === Proxy);
		product.events.onChange.subscribe(h);
		console.assert(product.events.onChange.subscriptions.length === 2);
		model.product.name = "RFE Track";
		console.assert(events.length === (counter += 2));
		console.assert(events[counter - 1].context === product);
		console.assert(events[counter - 1].args[1] == "name");
		console.assert(events[counter - 1].args[3] == "RFE Track");
		//console.dir(events[counter -2]);
		//console.dir(events[counter -1]);
		console.assert(events[counter - 1].context !== events[counter - 2].context, "One event should be a child event the other should be a parent and thus should have different contexts.");
	})();

	(function() {
		var events = [], counter = 0, h = eventLogger(events);
		var tmp = {a: {b: "B"}}
		var model = new Proxy(tmp);
		model.events.onChange.subscribe(function(scope, property, before, after) {
			console.assert(scope === model.a, "The scope of the change handler should be the proxy child");
			console.assert(property === "b");
			console.assert(before === "B");
			console.assert(after === "C");
		});
		model.a.b = "C";
	})();

	// Test canceling beforeChange
	(function() {
		var events = [];
		var counter = 0;
		var h = eventLogger(events);
		
		var rfe = dummyModel();
		var model = new Proxy(rfe);
	
		model.events.beforeChange.subscribe(eventCancel.bind(model));
		var before = model.owner;
		model.owner = "something new";
		console.assert(model.owner === before, "Cancel didn't work and model.owner is %s", model.owner);
		console.assert(events.length === 0, "%d events were logged", events.length);
	})();

	// Test clear subscriptions
	(function() {
		var clear = new Proxy({a: "sdf"});
		clear.events.beforeChange.subscribe(function(){});
		clear.events.beforeChange.subscribe(function(){});
		clear.events.onChange.subscribe(function(){});
		console.assert(clear.events.beforeChange.subscriptions.length === 2);
		console.assert(clear.events.onChange.subscriptions.length === 1);
		clear.events.beforeChange.clear();
		console.assert(clear.events.beforeChange.subscriptions.length === 0, "%d beforeChange listeners", clear.events.beforeChange.subscriptions.length);
	})();
	
	(function() {
		// Test clear
		var clear2 = new Proxy({a: "sdf"});
		clear2.events.beforeChange.subscribe(function(){}, clear2);
		clear2.events.beforeChange.subscribe(function(){}, window);
		clear2.events.onChange.subscribe(function(){});
		console.assert(clear2.events.beforeChange.subscriptions.length === 2);
		console.assert(clear2.events.onChange.subscriptions.length === 1);
		clear2.events.beforeChange.clear(clear2);
		console.assert(clear2.events.beforeChange.subscriptions.length === 1, "%d beforeChange listeners", clear2.events.beforeChange.subscriptions.length);
	})();
	
	// Set null
	(function() {
		var events = [], counter = 0, h = eventLogger(events);
		
		var rfe = dummyModel();
		var model = new Proxy(rfe);
		model.events.onChange.subscribe(h.bind(model));
		
		// Test null
		model.product = null;
		console.assert(events.length === (counter += 1), "There should be exactly one listener on changes to the product property but there are %d", events.length);
		console.assert(null === model.product, "Product should be null, but is %s", model.product);
		model.product = {a: "sdf", b: "qwer"};
		console.assert(events.length === (counter += 1), "%d", counter);
		console.assert(model.product instanceof Proxy);
		console.assert(model.product.a === "sdf");
		console.assert(!(model.source.product instanceof Proxy));
		console.assert(model.source.product instanceof Object);
		console.assert(model.source.product.a === "sdf");
	})();
	
	// Item
	(function() {
		var events = [], counter = 0, h = eventLogger(events);
		
		var tags = ["a", "b", "c"];
		var model = new ArrayProxy(tags);
		model.events.onChange.subscribe(h.bind(model));
		
		console.assert(model.item(1) === "b", "Expecting 'b', got %s", model.item(1));
		console.assert(model.item(22) === undefined);
	})();
	
	// Item
	(function() {
		var events = [], counter = 0, h = eventLogger(events);
		
		var tags = [{a: "A"}, ["b", "c"], null, new Date(), 44];
		var model = new ArrayProxy(tags);
		model.events.onChange.subscribe(h.bind(model));
		
		console.assert(model.item(0) instanceof Proxy);
		console.assert(model.item(1) instanceof ArrayProxy);
		console.assert(model.item(2) === null);
		console.assert(model.item(3) instanceof Date);
		console.assert(typeof model.item(4) === "number");
	})();
	
	// Make sure proxy caching works
	(function(){
		var tags = [{a: "A"}, ["b", "c"], null, new Date(), 44];
		var model = new ArrayProxy(tags);
		
		console.assert(new Proxy({}) !== new Proxy({}));
		console.assert(model.item(0) === model.item(0));
	})();
	
	// ArrayProxy event bubbling
	(function() {
		var events = [], counter = 0, h = eventLogger(events);
		
		var tags = [{a: "A"}, ["b", "c"], null, new Date(), 44];
		var model = new ArrayProxy(tags);
		model.events.onChange.subscribe(h);
		
		model.item(0).a = "NEW A";
		//console.dir(events);
		console.assert(model.item(0).a === "NEW A");
		console.assert(events.length === 1);
		//console.dir(events[0].context);
		//console.assert(events[0].context === model.item(0));
	})();
	
	// Set primitive
	(function() {
		var events = [], counter = 0, h = eventLogger(events);
		
		var tags = ["a", "b", "c"];
		var model = new ArrayProxy(tags);
		model.events.onChange.subscribe(h.bind(model));
		
		console.assert(model instanceof ArrayProxy);
		console.assert(model.length === 3);
		console.assert(model.item(0).constructor === String);
		console.assert(model.item(7) === undefined);
		console.assert(model.item(7) !== null);
		console.assert(events.length === 0);
	
		// Array set primitive
		model.set(1, "X");
		console.assert(events.length === ++counter);
		console.assert(events[counter - 1].context === model);
		console.assert(events[counter - 1].args[0] === 1); // Array index
		console.assert(events[counter - 1].args[1] === "b"); // before
		console.assert(events[counter - 1].args[2] === "X"); // after
		
		// Array set primitive
		model.set(1, "Y");
		console.assert(events.length === ++counter);
		console.assert(events[counter - 1].context === model);
		console.assert(events[counter - 1].args[0] === 1); // Array index
		console.assert(events[counter - 1].args[1] === "X"); // before
		console.assert(events[counter - 1].args[2] === "Y"); // after
	})();
	
	(function() {
		var events = [], counter = 0, h = eventLogger(events);
		
		var tags = ["a", "b", "c"];
		var model = new ArrayProxy(tags);
		model.events.onChange.subscribe(h.bind(model));
		
		// Array push
		var oldLength = tags.length;
		model.push("new one");
		console.assert(events.length === ++counter);
		console.assert(events[counter - 1].context === model);
		console.assert(events[counter - 1].args[0] === oldLength);
		console.assert(events[counter - 1].args[1] === undefined);
		console.assert(events[counter - 1].args[2] === "new one");
		console.assert(model.source[tags.length - 1] === "new one");
	})();
	(function(){
		var obj = {a: [1,2]};
		var model = new Proxy(obj);
		model.events.onChange.subscribe(function() {
			console.dir(arguments);
		});
		obj.a[1] = {b: "B"};
	})();
}();