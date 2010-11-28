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
