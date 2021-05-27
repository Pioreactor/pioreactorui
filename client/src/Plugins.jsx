import React from "react";

import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import {Typography} from '@material-ui/core';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import DeleteIcon from '@material-ui/icons/Delete';
import Avatar from '@material-ui/core/Avatar';
import ExtensionIcon from '@material-ui/icons/Extension';
import GetAppIcon from '@material-ui/icons/GetApp';

const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: "15px"
  },
  title: {
    fontSize: 14,
  },
  cardContent: {
    padding: "10px"
  },
  pos: {
    marginBottom: 0,
  },
  pluginList:{
    width: "95%",
    margin: "auto",
    marginBottom: "15px"
  },
  secondaryActionButton:{
    marginLeft: "10px"
  }
}));



function PageHeader(props) {
  const classes = useStyles();

  return (
    <React.Fragment>
    <div>
      <div>
        <Typography variant="h5" component="h2">
          <Box fontWeight="fontWeightBold">
            Plugins
          </Box>
        </Typography>
      </div>
    </div>
    </React.Fragment>
  )
}



function ListAvailablePlugins(){

  const classes = useStyles();

  const [installedPlugins, setInstalledPlugins] = React.useState([])

  React.useEffect(() => {
    async function getData() {
         await fetch("/get_installed_plugins")
        .then((response) => {
          return response.json();
        })
        .then((json) => {
          setInstalledPlugins(json)
        });
      }
      getData()
  }, [])

  const installPlugin = (plugin_name) => () => (
      fetch('/install_plugin', {
        method: "POST",
        body: JSON.stringify({plugin_name: plugin_name}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
  )

  return (
    <div className={classes.pluginList}>
     <List dense={true}>
        {installedPlugins.map(plugin =>
          <ListItem key={plugin.name}>
            <ListItemAvatar>
              <Avatar>
                <ExtensionIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={plugin.name}
              secondary={plugin.description}
            />
            <ListItemSecondaryAction>

              <Button
                onClick={installPlugin(plugin.name)}
                variant="text"
                size="small"
                color="inherit"
                aria-label="delete"
                endIcon={<GetAppIcon />}
                className={classes.secondaryActionButton}
              >
                Install
              </Button>
              <Button
                href={plugin.homepage}
                target="_blank" rel="noopener"
                variant="text"
                size="small"
                color="inherit"
                aria-label="install"
                disabled={!plugin.homepage}
                endIcon={<OpenInNewIcon />}
                className={classes.secondaryActionButton}
              >
                View
              </Button>
              </ListItemSecondaryAction>

          </ListItem>,
        )}
      </List>
    </div>
  )
}



function ListInstalledPlugins(){

  const classes = useStyles();

  const [installedPlugins, setInstalledPlugins] = React.useState([])

  React.useEffect(() => {
    async function getData() {
         await fetch("/get_installed_plugins")
        .then((response) => {
          return response.json();
        })
        .then((json) => {
          setInstalledPlugins(json)
        });
      }
      getData()
  }, [])


  const uninstallPlugin = (plugin_name) => () => (
      fetch('/uninstall_plugin', {
        method: "POST",
        body: JSON.stringify({plugin_name: plugin_name}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
  )

  return (
    <div className={classes.pluginList}>
     <List dense={true}>
        {installedPlugins.map(plugin =>
          <ListItem key={plugin.name}>
            <ListItemAvatar>
              <Avatar>
                <ExtensionIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={plugin.name}
              secondary={plugin.description}
            />
            <ListItemSecondaryAction>

              <Button
                onClick={uninstallPlugin(plugin.name)}
                variant="text"
                size="small"
                color="inherit"
                aria-label="delete"
                endIcon={<DeleteIcon />}
                className={classes.secondaryActionButton}
              >
                Uninstall
              </Button>
              <Button
                href={plugin.homepage}
                target="_blank" rel="noopener"
                variant="text"
                size="small"
                color="inherit"
                aria-label="delete"
                disabled={!plugin.homepage}
                endIcon={<OpenInNewIcon />}
                className={classes.secondaryActionButton}
              >
                View
              </Button>
            </ListItemSecondaryAction>
          </ListItem>,
        )}
      </List>
    </div>
  )
}


function PluginContainer(){
  const classes = useStyles();


  return(
    <React.Fragment>
      <PageHeader/>
      <Card className={classes.root}>
        <CardContent className={classes.cardContent}>
          <p> Install, manage, and discover new Pioreactor plugins created by the community. These plugins can provide new functionalities for your Pioreactor (additional hardware may be necessary), or new automations to control dosing, temperature and LED operations.</p>

         <Typography variant="h6" component="h3">
          Installed plugins
         </Typography>
          <ListInstalledPlugins/>


         <Typography variant="h6" component="h3">
          Available plugins from the community
         </Typography>
          <ListAvailablePlugins/>


          <p style={{textAlign: "center", marginTop: "30px"}}><span role="img">💡</span> Learn more about Pioreactor  <a href="https://pioreactor.com/pages/installing-and-managing-plugins" target="_blank" rel="noopener noreferrer">plugins</a>.</p>

        </CardContent>
      </Card>
    </React.Fragment>
)}


function Plugins(props) {
    React.useEffect(() => {
    document.title = props.title;
  }, [props.title])
    return (
        <Grid container spacing={2} >
          <Grid item md={12} xs={12}>
            <PluginContainer/>
          </Grid>
        </Grid>
    )
}


export default Plugins;
