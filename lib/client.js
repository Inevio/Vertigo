
// Modules
var net = require('net');

// Export Module
module.exports = function( opts, ports ){

  // Variables
  var clientId   = 0;
  var clientKeys = [];
  var client     = {};
  var round      = -1;
  var counter    = 0;
  var operations = {};
  var result     = {};

  // Local functions
  var addServer = function( opts, port ){

    net.connect( port, opts || {} )
    .on( 'connect', connectedServer )
    .on( 'data', doOperations )
    .on( 'error', noop )
    .on( 'close', function(){

      delete client[ this.vertigoId ];

      this.cache = '';

      clientKeys = Object.keys( client );

      this.connect( port );

    });

  };

  var connectedServer = function(){

    this.setNoDelay( true );

    this.vertigoId           = clientId++;
    this.cache               = '';
    client[ this.vertigoId ] = this;
    clientKeys               = Object.keys( client );

  };

  var doOperations = function( data ){

    this.cache += data;

    while( data = getOperationFromCache.call( this ) ){
      executeOperation( data );
    }

  };

  var getOperationFromCache = function(){

    var cut = this.cache.indexOf('\0');

    if( cut === -1 ){
      return;
    }

    var cutted = this.cache.slice( 0, cut );
    this.cache = this.cache.slice( cut + 1 );

    return JSON.parse( cutted );

  };

  var executeOperation = function( data ){

    var cbId = data.shift();
    var end  = data.shift();

    if( operations[ cbId ] ){

      if( operations[ cbId ].multi ){

        if( end ){
          operations[ cbId ][ 1 ].apply( null, data );
        }else{
          operations[ cbId ][ 0 ].apply( null, data );
        }

      }else{
        operations[ cbId ].apply( null, data );
      }

      if( end ){
        delete operations[ cbId ];
      }

    }

  };

  var getClient = function( callback ){

    round = ++round % clientKeys.length || 0;

    if( client[ clientKeys[ round ] ] ){
      callback( client[ clientKeys[ round ] ] );
      return;
    }

    setInmediate( function(){
      getClient( callback );
    });

  };

  var noop = function(){};

  if( typeof setInmediate === 'undefined' ){

    var setInmediate = function( cb ){
      return setTimeout( cb, 0 );
    };

  }

  // Parse arguments
  if( arguments.length < 2 ){
    ports = opts;
    opts = null
  }

  if( opts && opts.ssl ){
    net = require('tls');
    opts = opts.ssl;
  }

  // Connect with the servers and listen events
  if( ports instanceof Array ){
    ports.forEach(function( p ){ addServer( opts, p ) });
  }else{
    addServer( opts, ports );
  }

  result = {

    request : function(){

      var args = Array.prototype.slice.call( arguments, 0 );
      var cbId = 0;

      if( typeof args[ args.length - 1 ] === 'function' ){

        cbId                    = ++counter;
        operations[ cbId ]      = args[ args.length - 1 ];
        args[ args.length - 1 ] = cbId;

      }else{
        args[ args.length ] = 0;
      }

      getClient( function( client ){
        client.write( JSON.stringify( args ) + '\0' );
      });

      return result;

    },

    multiRequest : function(){

      var args = Array.prototype.slice.call( arguments, 0 );
      var cbId = 0;

      if( typeof args[ args.length - 1 ] === 'function' ){

        cbId                     = ++counter;
        operations[ cbId ]       = [ args[ args.length - 2 ], args[ args.length - 1 ] ];
        operations[ cbId ].multi = true;
        args[ args.length - 2 ]  = cbId;
        args[ args.length - 1 ]  = true;

      }else{
        args[ args.length ] = 0;
      }

      getClient( function( client ){
        client.write( JSON.stringify( args ) + '\0' );
      });

      return result;

    },

    send : function(){

      var args = Array.prototype.slice.call( arguments, 0 );

      args[ args.length ] = 0;

      getClient( function( client ){
        client.write( JSON.stringify( args ) + '\0' );
      });

      return result;

    }

  };

  return result;

};
