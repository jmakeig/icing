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
Function.prototype.extend = function(superclass, proto) {
	// create our new subclass
	this.prototype = new superclass();

	// optional subclass methods and properties
	if (proto) {
		for (var i in proto)
			this.prototype[i] = proto[i];
	}
}

if (typeof Function.prototype.bind === "undefined") {
	Function.prototype.bind = function(context) {
		var me = this;
		function bound() {
			return me.apply(context, arguments);
		}
		return bound;
	}
}
ML.lang = function() {
	return {
		isPrimitive: function(object) {
			if(object == null) return false; // TODO: How should nulls be handled?
			var construktor = object.constructor;
			if(construktor === String) return true;
			if(construktor === Number) return true;
			if(construktor === Date) return true;
			if(construktor === Boolean) return true;
			return false;
    },
    isArray: function(object) {
    	if(object == null) return false;
    	return object.constructor === Array
    }
	}
}();
