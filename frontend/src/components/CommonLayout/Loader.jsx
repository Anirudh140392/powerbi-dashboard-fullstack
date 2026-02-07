import React from 'react';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';

const Loader = ({ message = "Loading..." }) => {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: '300px',
                width: '100%',
                gap: 2,
            }}
        >
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress
                    size={60}
                    thickness={4}
                    sx={{
                        color: theme.palette.primary.main,
                        'circle': {
                            strokeLinecap: 'round',
                        },
                    }}
                />
                <Box
                    sx={{
                        top: 0,
                        left: 0,
                        bottom: 0,
                        right: 0,
                        position: 'absolute',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Typography
                        variant="caption"
                        component="div"
                        color="text.secondary"
                        sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                    >
                        Wait
                    </Typography>
                </Box>
            </Box>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                    fontWeight: 500,
                    letterSpacing: '0.5px',
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '@keyframes pulse': {
                        '0%': { opacity: 0.6 },
                        '50%': { opacity: 1 },
                        '100%': { opacity: 0.6 },
                    },
                }}
            >
                {message}
            </Typography>
        </Box>
    );
};

export default Loader;
