/**
 * Copyright (c) 2011 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Class.define("aiagallery.dbif.DbifAppEngine",
{
  extend  : liberated.appengine.Dbif,
  type    : "singleton",

  include : 
  [
    aiagallery.dbif.MDbifCommon
  ],
  
  construct : function()
  {
    // Call the superclass constructor
    this.base(arguments);
    
    // Prepare for remote procedure calls to aiagallery.features.*
    this.__rpc = 
      new liberated.appengine.Rpc([ "aiagallery", "features" ], "/rpc");
  },
  
  members :
  {
    /**
     * Register a service name and function.
     *
     * @param serviceName {String}
     *   The name of this service within the <[rpcKey]> namespace.
     *
     * @param fService {Function}
     *   The function which implements the given service name.
     * 
     * @param paramNames {Array}
     *   The names of the formal parameters, in order.
     */
    registerService : function(serviceName, fService, paramNames)
    {
      // Register with the RPC provider
      this.__rpc.registerService(serviceName, fService, this, paramNames);
    },

    /**
     * Process an incoming request which is presumably a JSON-RPC request.
     * 
     * @param jsonData {String}
     *   The data provide in a POST request
     * 
     * @return {String}
     *   Upon success, the JSON-encoded result of the RPC request is returned.
     *   Otherwise, null is returned.
     */
    processRequest : function(jsonData)
    {
      return this.__rpc.processRequest(jsonData);
    },

    /**
     * Identify the current user. Register him in the whoAmI property.
     */
    identify : function()
    {
      var             UserServiceFactory;
      var             userService;
      var             user;
      var             whoami;
      var             displayName;
      var             visitor;
      var             googleUserId;
      var             googleNickname;
      var             permissions;

      // Find out who is logged in
      UserServiceFactory =
        Packages.com.google.appengine.api.users.UserServiceFactory;
      userService = UserServiceFactory.getUserService();
      user = userService.getCurrentUser();
      
      // If no one is logged in...
      if (! user)
      {
        this.setWhoAmI(
          {
            email             : "anonymous",
            userId            : -1,
            displayName       : "",
            isAdmin           : false,
            logoutUrl         : "",
            permissions       : [],
            hasSetDisplayName : true
          });
        return;
      }

      whoami = String(user.getEmail());
      googleNickname = String(user.getNickname());
      googleUserId = String(user.getUserId());

      // Try to get this user's display name. Does the visitor exist?
      visitor =
        liberated.dbif.Entity.query("aiagallery.dbif.ObjVisitors", whoami);
      if (visitor.length > 0)
      {
        // Yup, he exists.
        displayName = visitor[0].displayName || googleNickname || googleUserId;
        permissions = visitor[0].permissions || [];
      }
      else
      {
        // He doesn't exist. Just use the unique number.
        displayName = googleNickname || googleUserId;
        permissions = [];
      }

      // Save the logged-in user. The whoAmI property is in MDbifCommon.
      this.setWhoAmI(
        {
          email             : whoami,
          userId            : googleUserId,
          displayName       : displayName,
          isAdmin           : userService.isUserAdmin(),
          logoutUrl         : userService.createLogoutURL("/"),
          permissions       : permissions,
          hasSetDisplayName : displayName != googleUserId
        });
    }
  },

  defer : function()
  {
    // Register our put, query, and remove functions
    liberated.dbif.Entity.registerDatabaseProvider(
      liberated.appengine.Dbif.query,
      liberated.appengine.Dbif.put,
      liberated.appengine.Dbif.remove,
      liberated.appengine.Dbif.getBlob,
      liberated.appengine.Dbif.putBlob,
      liberated.appengine.Dbif.removeBlob,
      liberated.appengine.Dbif.beginTransaction,
      { 
        dbif        : "appengine",
        initRootKey : liberated.appengine.Dbif.initRootKey
      });
  }
});
