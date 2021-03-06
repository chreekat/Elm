
var Elm = Elm || {};
Elm.Signal = function() {
  var send = function(node, timestep, changed) {
    var kids = node.kids;
    for (var i = kids.length; i--; ) {
      kids[i].recv(timestep, changed, node.id);
    }
  };
  var input = function(base) {
    this.id = Guid.guid();
    this.value = base;
    this.kids = [];
    this.defaultNumberOfKids = 0;
    this.recv = function(timestep, eid, v) {
      var changed = eid === this.id;
      if (changed) { this.value = v; }
      send(this, timestep, changed);
      return changed;
    };
    Dispatcher.inputs.push(this);
  };
  var lift = function(func,args) {
    this.id = Guid.guid();
    this.value = null;
    this.kids = [];
    this.count = 0;
    this.changed = false;
    
    args.reverse();
    this.recalc = function() {
	var f = func;
	for (var i = args.length; i--; ) {
	    f = f(args[i].value);
	}
	this.value = f;
    };
    this.recalc();
    
    this.recv = function(timestep, changed, parentID) {
      this.count += 1;
      if (changed) { this.changed = true; }
      if (this.count == args.length) {
	  if (this.changed) { this.recalc() }
	  send(this, timestep, this.changed);
	  this.changed = false;
	  this.count = 0;
      }
    };
    for (var i = args.length; i--; ) {
      args[i].kids.push(this);
    }
  };
  var fold = function(func,base,baseIsFunc,input) {
    this.id = Guid.guid();
    this.value = baseIsFunc ? base(input.value) : base;
    this.kids = [];
    this.recv = function(timestep, changed, parentID) {
      if (changed) { this.value = func(input.value)(this.value); }
      send(this, timestep, changed);
    };
    input.kids.push(this);
  };

  var dropIf = function(pred,base,input) {
    this.id = Guid.guid();
    this.value = pred(input.value) ? base : input.value;
    this.kids = [];
    this.recv = function(timestep, changed, parentID) {
	var chng = changed && !pred(input.value);
	if (chng) { this.value = input.value; }
	send(this, timestep, chng);
    };
    input.kids.push(this);
  };
  var dropRepeats = function(input) {
      this.id = Guid.guid();
      this.value = input.value;
      this.kids = [];
      this.recv = function(timestep, changed, parentID) {
	  var chng = changed && !eq(this.value,input.value);
	  if (chng) { this.value = input.value; }
	  send(this, timestep, chng);
      };
      input.kids.push(this);
  };
  
  var dropWhen = function(s1) { return function(b) { return function(s2) {
    var pairs = new lift(function(x){return function(y){return [x,y];};},[s1,s2]);
    var dropped = new dropIf(function(p){return p[0];},[true,b],pairs);
    return new lift(function(p){return p[1];},[dropped]); }; };
  };

  var sampleOn = function(s1,s2) {
    this.id = Guid.guid();
    this.value = s2.value;
    this.kids = [];
    this.count = 0;
    this.changed = false;
    
    this.recv = function(timestep, changed, parentID) {
	if (parentID === s1.id) this.changed = changed;
	this.count += 1;
	if (this.count == 2) {
	    if (this.changed) { this.value = s2.value; }
	    send(this, timestep, this.changed);
	    this.count = 0;
	    this.changed = false;
	}
    };
    s1.kids.push(this);
    s2.kids.push(this);
  };
  
  return {
    constant : function(v) { return new input(v); },
    lift  : function(f){return function(e){return new lift(f,[e]);};},
    lift2 : function(f) { return function(e1) { return function(e2) {
		  return new lift(f, [e1,e2]); }; }; },
    lift3 : function(f) { return function(e1) { return function(e2) {
		  return function(e3){return new lift(f,[e1,e2,e3]);};};};},
    lift4 : function(f) { return function(e1) { return function(e2) {
		  return function(e3) { return function(e4) {
			  return new lift(f, [e1,e2,e3,e4]); }; }; }; }; },
    foldp : function(f) { return function(b) { return function(e) {
		  return new fold(f,b,false,e); }; }; },
    foldp_ : function(f) { return function(b) { return function(e) {
		  return new fold(f,b,true,e); }; }; },
    foldp1 : function(f) { return function(e) {
	      return new fold(f,function(x){return x;},true,e); }; },
    count : function(sig) {
	  var incr = function(_){return function(c){return c+1;};};
	  return new fold(incr,0,false,sig) },
    keepIf : function(pred) { return function(base) { return function(sig) {
		  return new dropIf(function(x) { return !pred(x)},base,sig); }; }; },
    dropIf : function(pred) { return function(base) { return function(sig) {
		  return new dropIf(pred,base,sig); }; }; },
    keepWhen : function(s) { return dropWhen(new lift(function(b){return !b;},[s])); },
    dropWhen : dropWhen,
    dropRepeats : function(s) { return new dropRepeats(s);},
    sampleOn : function(s1){return function(s2){return new sampleOn(s1,s2);};}
  };
}();