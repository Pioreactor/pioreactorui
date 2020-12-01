import React from 'react'
import {AppBar, Toolbar, Typography, Link, Button} from '@material-ui/core';
import {makeStyles} from '@material-ui/styles';
import Drawer from './Drawer'
import OpenInNewIcon from '@material-ui/icons/OpenInNew';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  title: {
    flexGrow: 1,
  },
}));


const Header = () => {
    const classes = useStyles();
    return (
    <div className={classes.root}>
      <AppBar position="static">
        <Toolbar variant="dense">
          <Drawer />
          <Typography variant="h6" className={classes.title}>
            <Link color="inherit" underline="none" href="/dashboard" className={classes.title}> Pioreactor </Link>
          </Typography>
          <Button color="inherit">
            <Link color="inherit" underline="none" href="https://github.com/Pioreactor/pioreactor/wiki" target="_blank" rel="noopener"> Help </Link> <OpenInNewIcon fontSize="small"/>
          </Button>
        </Toolbar>
      </AppBar>
    </div>
    )
}

export default Header;
