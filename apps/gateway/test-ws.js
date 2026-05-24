const fastify = require('fastify')();
fastify.register(require('@fastify/websocket'));
fastify.register(async function (fastify) {
  fastify.get('/', { websocket: true }, async (connection, req) => {
    connection.socket.on('message', message => {
      connection.socket.send('hi from server');
    })
    console.log('Handler returning...');
  })
})
fastify.listen({ port: 3000 }, err => {
  if (err) throw err;
  console.log('Listening on 3000');
});
