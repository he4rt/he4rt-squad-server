const express = require("express")
const cors = require("cors")
const app = express()

const admin = require("firebase-admin")
const credentials = ("./serviceAccount.json")

admin.initializeApp({
  credential: admin.credential.cert(credentials)
})

app.use(express.json())
app.use(cors())
app.use(express.urlencoded({ extended: true }))

const store = admin.firestore()

app.post('/auth', async (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password,
    displayName: `GUEST-${Math.random().toString(36).substring(2,7)}`,
    invites: []
  }

  try {
    const userResponse = await admin.auth().createUser({
      ...user,
      emailVerified: false,
      disabled: false
    })

    store.collection('users').doc(userResponse.uid).set({
      id: userResponse.uid,
      ...user
    })

    res.json(userResponse)
  } catch(e) {
    const response = await admin.auth().getUserByEmail(user.email)

    const target = await store.collection('users').doc(response.uid).get()

    if (target.data().password !== user.password) {
      res.status(400).send('Wrong password')

      return
    }

    res.json(response)
  }
})

app.get('/users/:id', async (req, res) => {
  const response = await store.collection('users').doc(req.params.id).get()
  const user = response.data()

  if(!user || !response.data) {
    res.status(404).send('User not found')

    return
  }

  res.json(user)
})

app.put('/users/nickname', async (req, res) => {
  const responseUser = await store.collection('users').doc(req.body.id).get()
  const responseUsers =  await store.collection('users').get()

  const user = responseUser.data()
  const users = responseUsers.docs.map(doc => doc.data())

  const nickname = req.body.nickname

  if(users.find(user => user.displayName === nickname)) {
    res.status(400).send('Exists nickname')

    return
  }

  user.displayName = nickname

  const userResponse = await store.collection('users').doc(req.body.id).set(user)

  res.json({
    ...user,
    ...userResponse
  })
})

app.get('/users/teams/:id', async (req, res) => {
  const response = await store.collection('teams').get()
  const member = (await store.collection('users').doc(req.params.id).get()).data()

  const allTargets = []

  const ownerTargets = response.docs.filter(doc => doc.data().ownerId === req.params.id).map(doc => doc.data())
  response.docs.forEach(async (doc) => {
    const res = doc.data()

    const result = res.usersId.find(user => user === member.displayName && res.ownerId !== req.params.id)

    if(result) {
      allTargets.push(res)
    }
  })

  allTargets.push(...ownerTargets)

  res.json(allTargets)
})

app.post('/teams', async (req, res) => {
  const data = {
    name: req.body.name,
    image: req.body.image || 'https://i.imgur.com/vlU6ZAZ.jpg',
    ownerId: req.body.id,
    description: req.body.description,
    activateProject: req.body.activateProject || '',
    level: 1,
    tasks: 0,
    usersId: []
  }

  const response = await store.collection('teams').doc(data.name).set(data)

  res.json(response)
})

app.delete('/teams', async (req, res) => {
  const response = await store.collection('teams').doc(req.body.name).delete()

  res.json(response)
})

app.get('/teams', async (req, res) => {
  const response = await store.collection('teams').get()
  const teams = response.docs.map(doc => doc.data())

  teams.sort((a, b) => a.tasks - b.tasks);

  const highTeams = teams.slice(0, 10);

  res.json(highTeams)
})

app.get('/teams/owner/:name', async (req, res) => {
  const response = await store.collection('teams').doc(req.params.name).get()
  const data = response.data()
  const arr = []

  data.usersId.forEach(async (user) => {
    const item = await store.collection('users').doc(user).get()
    arr.push(item.data())  
  })

  const owner = await store.collection('users').doc(data.ownerId).get()
  arr.unshift(owner.data())
  
  res.json(arr)
})

app.post('/teams/invite', async (req, res) => {
  try {
    const usersDoc = await store.collection('users').get()
    const docs = usersDoc.docs.map(doc => doc.data())

    const doc = docs.find(doc => doc.displayName === req.body.userName)

    if(!doc) {
      res.status(404).send('Target user not exists')
      
      return
    }

    const target = await store.collection('users').doc(doc.id).get()

    const user = target.data()
    user.invites.push(req.body.teamName)
  
    const response = await store.collection('users').doc(doc.id).set(user)
  
    res.json(response)
  } catch(e) {
    res.status(400).send('User not exists')
  }
})

app.post('/teams/invite/decline', async (req, res) => {
  try {
    const target = await store.collection('users').doc(req.body.id).get()
    const user = target.data()

    user.invites = user.invites.filter(invite => invite !== req.body.inviteName)
  
    const response = await store.collection('users').doc(req.body.id).set(user)
  
    res.json(response)
  } catch(e) {
    res.status(400).send('User not exists')
  }
})

app.post('/teams/invite/accept', async (req, res) => {
  try {
    const target = await store.collection('users').doc(req.body.id).get()
    const user = target.data()

    user.invites = user.invites.filter(invite => invite !== req.body.inviteName)
  
    await store.collection('users').doc(req.body.id).set(user)

    const team = await store.collection('teams').doc(req.body.inviteName).get()
    const teamData = team.data()

    teamData.usersId.push(req.body.id)
  
    const teamResponse = await store.collection('teams').doc(req.body.inviteName).set(teamData)

    res.json(teamResponse)
  } catch(e) {
    res.status(400).send('User not exists')
  }
})

app.post('/teams/accept', async (req, res) => {
  try {
    const target = await store.collection('users').doc(req.body.id).get()
    const user = target.data()

    user.invites = user.invites.filter(team => team !== req.body.teamName)

    await store.collection('users').doc(req.body.name).set(user)

    const team = await store.collection('teams').doc(req.body.teamName).get()
    const teamData = team.data()

    teamData.usersId.push(req.body.id)

    const response = await store.collection('teams').doc(req.body.teamName).set(teamData)

    res.json(response)
  }
  catch(e) {
    res.status(400)
  }
})

app.post('/projects', async (req, res) => {
  const data = {
    name: req.body.name,
    teamName: req.body.teamName,
    ownerId: req.body.id,
    image: req.body.image || '',
    stars: [],
    repoUrl: req.body.repoUrl,
  }

  const asTeam = await store.collection('projects').doc(data.name)
  if (asTeam.get()) {
    res.status(400)

    return
  }

  const response = await store.collection('projects').doc(data.name).set(data)

  res.json(response)
})

app.delete('/projects', async (req, res) => {
  const response = await store.collection('projects').doc(req.body.name).delete()

  res.json(response)
})

app.put('/projects/star', async (req, res) => {
  try {
    const response = await store.collection('projects').doc(req.body.name).get()
    const project = response.data()

    if(project.stars.find((user) => user === req.body.userId)) {
      res.status(400)

      return
    }

    project.stars.push(req.body.userId)
  
    const result = await store.collection('projects').doc(req.body.name).set(project)

    res.json(result)
  } catch(e) {
    res.status(400)
  }
})

const PORT = process.env.PORT || "3333"

app.listen(PORT, () => {})