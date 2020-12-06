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
            <Link color="inherit" underline="none" href="/dashboard" className={classes.title}> <img src="white_colour.png" style={{width: "120px"}}/> </Link>
          </Typography>
            <Link color="inherit" underline="none" href="https://github.com/Pioreactor/pioreactor/wiki" target="_blank" rel="noopener">
              <Button color="inherit">Help </Button>
            </Link>
        </Toolbar>
      </AppBar>
    </div>
    )
}

export default Header;
