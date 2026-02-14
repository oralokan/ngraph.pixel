
I will use `ngraph.pixel` to develop a web app that will display a graph with 50K nodes and 25K edges.
The graph layout is computed beforehand and is loaded from a JSON file.
The graph layout is 2D.

Initially, I want the complete graph to be displayed in the viewport.
My app will include a list of "bookmarks" to specific nodes.
When I click on a viewport, I want the camera to "fly to" the target node.

I was not able to resolve the issues below in the app layer, so I decided to fork `ngraph.pixel`. This repo is that fork.

### showNode()

The public API exposed by `index.js` includes a `showNode()` function that calls the internal `flyTo()` function
implemented in `lib/flyTo.js`.

There are two important problems:

1. `flyTo()` immediately sets the camera position to the target position. This is more like "teleport to" rather than "fly to".
   What I need is for the camera to actually move from its initial position to its target position smoothly.
2. When `flyTo()` sets the camera position, it does not update hit testing (see `lib/input.js` and `lib/hitTest.js`).
   Once the camera position updates, then labels pop up when the mouse is hovering over empty space. The cursor location
   no longer corresponds to the actual positions of the displayed nodes.

I want to fix these problems with `flyTo()`.

### Public flyToPosition()

Additionally, I want to implement a public API method called `flyToPosition()` that allows me to specify the viewport frame
rather than a specific node. In fact, the implementation of `showNode()` should call `flyToPosition()` by specifying the
appropriate viewport frame that has been resolved for the specified node.

### Movement speed issues

`lib/input.js` sets the movement speed, but the movement speed is too high when I get close to nodes.
I suspect that this might be because I am using a static layout, so the library always adjust speed
depending on all the nodes in the graph, rather than the ones that are visible; which would be available
if I was using dynamic layout. I am not sure about this.











