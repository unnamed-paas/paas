const DockerWrapper = require('../lib/DockerWrapper');
const Node = require('../server/models').Node;
const Database = require('../server/models').Database;
const Config = require('../server/models').Config;
const Machine = require('docker-machine');
const uuid = require('uuid/v4');
const errHandler = e => console.log(e);

module.exports = {
  list(req, res) {
    return Node.findAll()
      .then(nodes => {
        if (req.accepts('html')) {
          res.render('cluster/index', { nodes });
        } else {
          res.json({ nodes });
        }
      }).catch(error => {
        if (req.accepts('html')) {
          res.status(400).send(error);
        } else {
          res.status(400).json({ error });
        }
      });
  },

  async create(req, res) {
    const nodes = await Node.findAll();
    const workerNodes = nodes.filter(node => node.manager === false);
    const managerNode = nodes.find(node => node.manager === true);
    const allNodesActive = nodes.every(node => node.active);

    if (!allNodesActive) {
      const errors = [{ message: 'Node cannot be added while cluster is updating.' }];
      return res.render('cluster/index', { errors, nodes });
    }

    const DO_TOKEN = ''; // TODO: send from API

    const name = `worker-${uuid()}`;
    const nodeParams = {
      name,
      manager: false,
      active: false
    };

    console.log('Creating node in db...');
    Node.create(nodeParams)
    .then(() => res.redirect('/cluster'))
    .then(DockerWrapper.createMachine(name, DO_TOKEN))
		.catch(async (err) => {
			const workerNode = await Node.findOne({ where: { name }});
			await workerNode.destroy().catch(errHandler);
			throw err;
		})
    .then(DockerWrapper.joinSwarm(name))
    .then(async () => {
      const workerNode = await Node.findOne({ where: { name }});
      const workerIp   = await DockerWrapper.getNodeIp(name).catch(errHandler);
      console.log(`Updating db with IP address of worker node (${workerIp})...`);
      const params = {
        ip_address: workerIp,
        active: true,
      };
      return workerNode.update(params);
    })
    .catch(errHandler);
  },


  async delete(req, res) {
    const nodes = await Node.findAll();
    const workerNodes = nodes.filter(node => node.manager === false);
    const managerNode = nodes.find(node => node.manager === true);
    const allNodesActive = nodes.every(node => node.active);          // boolean for whether all nodes are active

    if (!allNodesActive) {
      const errors = [{ message: 'Node cannot be removed while cluster is updating.' }];
      return res.render('cluster/index', { errors, nodes });
    }

    if (workerNodes.length === 0) {
      const errors = [{ message: 'There are no nodes to remove!' }];
      return res.render('cluster/index', { errors, nodes });
    }

    const workerNode = workerNodes[0];

		workerNode.update({ active: false })
			.then(DockerWrapper.workerLeaveSwarm(workerNode.name))
			.then(DockerWrapper.removeMachine(workerNode.name))    // -- https://github.com/vweevers/node-docker-machine/issues/30
			.then(() => workerNode.destroy())
      .then(() => res.redirect('/cluster'));
  }
};
